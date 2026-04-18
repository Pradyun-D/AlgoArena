from django.contrib.auth.models import PermissionManager
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import redirect
from datetime import datetime, timezone
import uuid
from accounts.permissions import IsProblemSetter, IsProblemSetterOwner, IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response    
from .contest_serializer import ContestSerializer, EditorialSerializer, ProblemManageSerializer,ContestInfoSerializer
from db import get_connection
from .judge.submit import judge_submission

# Create your views here.

# hardcoding data for now when sql setup we change it

# Return list of registered rounds to javascript for rendering


#-------------------- helpers------------------------------------------------------------

def _build_registered_rounds(contest_history):
    registered_rounds = []

    for entry in contest_history:
        if not isinstance(entry, dict):
            continue

        is_registered = entry.get("registered")
        status = str(entry.get("status", "")).strip()

        if not is_registered and status not in {"Upcoming", "Active"}:
            continue

        if status == "Active":
            subtitle = "Active Now"
        elif entry.get("start_time"):
            subtitle = f"Starts at {entry['start_time']}"
        else:
            subtitle = "Registered"

        registered_rounds.append(
            {
                "title": entry.get("title", "Untitled Contest"),
                "subtitle": subtitle,
                "is_live": status == "Active",
            }
        )

    return registered_rounds[:4]


# ----------------------Dummy sidebar data; will implement later.--------------------------

def _build_sidebar_context(request):
    sidebar = {
        "username": "guest_user",
        "rating": 0,
        "total_solved": 0,
        "avg_rank": None,
        "top_percentile": None,
        "registered_rounds": [],
    }

    if not request.user.is_authenticated:
        return sidebar

    sidebar["username"] = request.user.username or request.user.email.split("@")[0]

    profile = getattr(request.user, "profile", None)
    if profile is None:
        return sidebar

    preferences = profile.preferences if isinstance(profile.preferences, dict) else {}
    contest_history = profile.contest_history if isinstance(profile.contest_history, list) else []

    sidebar["rating"] = preferences.get("rating", preferences.get("contest_rating", 0))
    sidebar["total_solved"] = preferences.get(
        "total_problems_solved",
        preferences.get("problems_solved", 0)
    )
    sidebar["top_percentile"] = preferences.get("top_percentile")
    sidebar["registered_rounds"] = _build_registered_rounds(contest_history)

    ranks = [
        entry.get("rank")
        for entry in contest_history
        if isinstance(entry, dict) and isinstance(entry.get("rank"), (int, float))
    ]

    if ranks:
        sidebar["avg_rank"] = round(sum(ranks) / len(ranks))

    return sidebar

def _serialize_submission_row(row):
    return {
        "submission_id": str(row["submission_id"]),
        "user_id": row.get("user_id"),
        "problem_id": str(row["problem_id"]),
        "contest_id": str(row["contest_id"]) if row.get("contest_id") else None,
        "language_id": row.get("language_id"),
        "language_name": row.get("language_name"),
        "source_code": row.get("source_code", ""),
        "status": row.get("status"),
        "verdict": row.get("verdict"),
        "execution_time_ms": row.get("max_execution_time_ms"),
        "memory_used_kb": row.get("max_memory_used_kb"),
        "submitted_at": row.get("submitted_at"),
    }


def _get_request_user_external_id(request):
    if not getattr(request.user, "is_authenticated", False):
        return None
    return getattr(request.user, "external_user_id", None)


def _can_view_private_contests(request):
    return getattr(request.user, "role", None) in {"admin", "problem_setter"}


def _contest_is_live(contest):
    if not contest:
        return False

    start_time = contest.get("start_time")
    end_time = contest.get("end_time")
    if start_time is None or end_time is None:
        return False

    now = datetime.utcnow()
    return start_time <= now < end_time


def _fetch_contest_with_registration(cursor, contest_id, user_id):
    cursor.execute(
        """
        SELECT
            c.contest_id,
            c.title,
            c.description,
            c.start_time,
            c.end_time,
            c.visibility,
            c.created_by,
            c.created_at,
            EXISTS(
                SELECT 1
                FROM contest_participants cp
                WHERE cp.contest_id = c.contest_id
                  AND cp.user_id = %s
            ) AS is_registered
        FROM contests c
        WHERE c.contest_id = %s
        LIMIT 1
        """,
        (str(user_id) if user_id is not None else None, contest_id),
    )
    return cursor.fetchone()


def _attach_creator_username(cursor, contest_row):
    if not contest_row:
        return contest_row

    created_by = contest_row.get("created_by")
    if created_by is None:
        contest_row["created_by_username"] = None
        return contest_row

    try:
        cursor.execute(
            """
            SELECT username
            FROM `user`
            WHERE user_id = %s
            LIMIT 1
            """,
            (created_by,),
        )
        user_row = cursor.fetchone() or {}
        contest_row["created_by_username"] = user_row.get("username")
    except Exception:
        contest_row["created_by_username"] = None

    return contest_row


def _is_privileged_contest_user(request):
    return getattr(request.user, "role", None) in {"admin", "problem_setter"}


def _parse_optional_datetime(value):
    raw = str(value or "").strip()
    if not raw:
        return None

    try:
        parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError("Invalid datetime format.") from exc

    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)

    return parsed


def _to_sql_datetime(value):
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M:%S")


def _can_manage_contest(request, contest_row):
    if getattr(request.user, "role", None) == "admin":
        return True

    owner_id = getattr(request.user, "external_user_id", None)
    if owner_id is None:
        return False

    return contest_row.get("created_by") == owner_id


def _validate_publishable_draft(draft):
    if not draft:
        return "Draft not found."

    title = str(draft.get("title") or "").strip()
    description = str(draft.get("description") or "").strip()
    start_time = draft.get("start_time")
    end_time = draft.get("end_time")

    if not title or title == "Untitled Draft":
        return "Add a real contest title before publishing this draft."
    if not description:
        return "Add a contest description before publishing this draft."
    if start_time is None or end_time is None:
        return "Set both start and end time before publishing this draft."
    if start_time >= end_time:
        return "End time must occur after start time."
    if int(draft.get("problem_count") or 0) < 1:
        return "Add at least one problem before publishing this draft."

    return None


def _extract_draft_problems(payload):
    if "problems" not in payload:
        return None

    problems = payload.get("problems", [])
    if not isinstance(problems, list):
        return []
    return [dict(problem) for problem in problems if isinstance(problem, dict)]


def _fetch_draft_problems(cursor, contest_id):
    cursor.execute(
        """
        SELECT
            p.problem_id,
            p.title,
            p.slug,
            p.description,
            p.difficulty,
            p.time_limit_ms,
            p.memory_limit_kb,
            p.visibility,
            cp.max_score
        FROM contest_problems cp
        JOIN problems p ON p.problem_id = cp.problem_id
        WHERE cp.contest_id = %s
        ORDER BY p.created_at ASC, p.problem_id ASC
        """,
        (contest_id,),
    )
    problems = cursor.fetchall()

    problem_ids = [str(problem["problem_id"]) for problem in problems]
    tags_by_problem = {problem_id: [] for problem_id in problem_ids}

    if problem_ids:
        placeholders = ", ".join(["%s"] * len(problem_ids))
        cursor.execute(
            f"""
            SELECT pt.problem_id, t.name
            FROM problem_tags pt
            JOIN tags t ON t.tag_id = pt.tag_id
            WHERE pt.problem_id IN ({placeholders})
            ORDER BY t.name ASC
            """,
            tuple(problem_ids),
        )
        for row in cursor.fetchall():
            tags_by_problem.setdefault(str(row["problem_id"]), []).append(row["name"])

    for problem in problems:
        problem["problem_id"] = str(problem["problem_id"])
        problem["tags"] = tags_by_problem.get(problem["problem_id"], [])

    return problems


def _attach_draft_problems(cursor, draft):
    if not draft:
        return draft
    problems = _fetch_draft_problems(cursor, draft["contest_id"])
    draft["problems"] = problems
    draft["problem_count"] = len(problems)
    return draft


def _delete_draft_problems(cursor, contest_id):
    cursor.execute(
        """
        SELECT problem_id
        FROM contest_problems
        WHERE contest_id = %s
        """,
        (contest_id,),
    )
    problem_ids = [str(row["problem_id"]) for row in cursor.fetchall()]

    if problem_ids:
        placeholders = ", ".join(["%s"] * len(problem_ids))
        cursor.execute(
            f"DELETE FROM problem_tags WHERE problem_id IN ({placeholders})",
            tuple(problem_ids),
        )
        cursor.execute(
            f"DELETE FROM contest_problems WHERE contest_id = %s AND problem_id IN ({placeholders})",
            (contest_id, *problem_ids),
        )
        cursor.execute(
            f"DELETE FROM problems WHERE problem_id IN ({placeholders})",
            tuple(problem_ids),
        )


def _persist_draft_problems_as_contest_problems(cursor, draft, problems):
    saved_problems = []

    for problem in problems:
        problem_id = str(uuid.uuid4())
        raw_tags = problem.get("tags", [])
        tags = raw_tags if isinstance(raw_tags, list) else []
        normalized_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
        title = str(problem.get("title", "") or "").strip()
        slug = str(problem.get("slug") or title).strip().lower().replace(" ", "-")

        cursor.execute(
            """
            INSERT INTO problems
            (problem_id, title, slug, description, difficulty, time_limit_ms,
             memory_limit_kb, visibility, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                problem_id,
                title,
                slug,
                problem.get("description", ""),
                problem.get("difficulty", "easy"),
                problem.get("time_limit_ms"),
                problem.get("memory_limit_kb"),
                problem.get("visibility", "public"),
                draft.get("created_by"),
            ),
        )
        cursor.execute(
            """
            INSERT INTO contest_problems (contest_id, problem_id, max_score)
            VALUES (%s, %s, %s)
            """,
            (draft["contest_id"], problem_id, problem.get("max_score")),
        )

        for tag_name in normalized_tags:
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    """
                    INSERT IGNORE INTO problem_tags (problem_id, tag_id)
                    VALUES (%s, %s)
                    """,
                    (problem_id, tag_row["tag_id"]),
                )

        saved_problem = dict(problem)
        saved_problem["problem_id"] = problem_id
        saved_problem["tags"] = normalized_tags
        saved_problems.append(saved_problem)

    return saved_problems


def _get_contests_data(include_private=False):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        visibility_clause = "" if include_private else "WHERE visibility <> 'private'"
        cursor.execute(
            """
            SELECT 
                contest_id,
                title,
                description,
                start_time,
                end_time,
                visibility,
                created_by,
                created_at,
                CASE
                    WHEN visibility = 'private' THEN 'Draft'
                    WHEN start_time > UTC_TIMESTAMP() THEN 'Draft'
                    WHEN end_time <= UTC_TIMESTAMP() THEN 'Completed'
                    ELSE 'Live'
                END AS status,
                COALESCE((
                    SELECT COUNT(*) 
                    FROM contest_participants cp 
                    WHERE cp.contest_id = contests.contest_id
                    ), 0) AS participants_count
            FROM contests
            """
            + visibility_clause
            + """
            ORDER BY start_time ASC, created_at ASC
            """
        )
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching contests for admin:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def _get_past_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT 
                contest_id,
                title,
                description,
                start_time,
                end_time,
                visibility,
                created_by,
                created_at,
                'Completed' AS status,
                COALESCE((
                    SELECT COUNT(*) 
                    FROM contest_participants cp 
                    WHERE cp.contest_id = contests.contest_id
                ), 0) AS participants_count
            FROM contests 
            WHERE end_time <= UTC_TIMESTAMP()
            ORDER BY end_time DESC, created_at DESC
            """
        )
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching past contests:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def get_active_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT 
                contest_id,
                title,
                description,
                start_time,
                end_time,
                visibility,
                created_by,
                created_at,
                CASE
                    WHEN start_time > UTC_TIMESTAMP() THEN 'Scheduled'
                    WHEN end_time <= UTC_TIMESTAMP() THEN 'Completed'
                    ELSE 'Live'
                END AS status,
                COALESCE((
                    SELECT COUNT(*)
                    FROM contest_participants cp
                    WHERE cp.contest_id = contests.contest_id
                ), 0) AS participants_count
            FROM contests 
            WHERE start_time <= UTC_TIMESTAMP() 
              AND end_time > UTC_TIMESTAMP()
            ORDER BY end_time DESC, created_at DESC
        """)
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching active contests:", e)
        return []
    finally:
        cursor.close()
        conn.close()

# to get all contests

@api_view(["GET"])
@permission_classes([AllowAny])
def all_contests(request):
    return Response(_get_contests_data(include_private=_can_view_private_contests(request)))


@api_view(["GET"])
@permission_classes([AllowAny])
def past_contests(request):
    return Response(_get_past_contests_data())


@api_view(["GET"])
@permission_classes([IsProblemSetter])
def list_drafts(request):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT c.contest_id, c.title, c.description, c.start_time, c.end_time, c.visibility,
                   c.created_by, c.created_at, c.updated_at,
                   COALESCE((
                       SELECT COUNT(*)
                       FROM contest_problems cp
                       WHERE cp.contest_id = c.contest_id
                   ), 0) AS problem_count
            FROM contests c
            WHERE c.visibility = 'private'
            ORDER BY c.updated_at DESC, c.created_at DESC
            """
        )
        return Response(cursor.fetchall(), status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsProblemSetter])
def create_draft(request):
    created_by = _get_request_user_external_id(request)
    if created_by is None:
        return Response({"error": "Authenticated user is not linked to a platform account."}, status=403)

    draft_payload = dict(request.data.get("contest", request.data) or {})
    title = str(draft_payload.get("title", "") or "").strip() or "Untitled Draft"
    description = str(draft_payload.get("description", "") or "").strip()
    visibility = "private"

    try:
        start_time = _parse_optional_datetime(draft_payload.get("start_time"))
        end_time = _parse_optional_datetime(draft_payload.get("end_time"))
    except ValueError as e:
        return Response({"error": str(e)}, status=400)

    if start_time and end_time and start_time >= end_time:
        return Response({"error": "End time must occur after start time."}, status=400)

    contest_id = str(uuid.uuid4())

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            INSERT INTO contests
            (contest_id, title, description, start_time, end_time, visibility, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                contest_id,
                title,
                description,
                _to_sql_datetime(start_time),
                _to_sql_datetime(end_time),
                visibility,
                created_by,
            ),
        )
        conn.commit()

        problems = _extract_draft_problems(draft_payload) or []
        if problems:
            _persist_draft_problems_as_contest_problems(cursor, {"contest_id": contest_id, "created_by": created_by}, problems)
            conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        draft["problems"] = problems
        draft["problem_count"] = len(problems)
        return Response({"message": "Draft saved successfully.", "draft": draft}, status=201)
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET", "PUT"])
@permission_classes([IsProblemSetter])
def draft_detail(request, contest_id):
    contest_id = str(contest_id)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        draft = _attach_draft_problems(cursor, draft)

        if request.method == "GET":
            return Response({"draft": draft}, status=200)

        draft_payload = dict(request.data.get("contest", request.data) or {})
        title = str(draft_payload.get("title", "") or "").strip() or "Untitled Draft"
        description = str(draft_payload.get("description", "") or "").strip()
        visibility = "private"

        try:
            start_time = _parse_optional_datetime(draft_payload.get("start_time"))
            end_time = _parse_optional_datetime(draft_payload.get("end_time"))
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        if start_time and end_time and start_time >= end_time:
            return Response({"error": "End time must occur after start time."}, status=400)

        cursor.execute(
            """
            UPDATE contests
            SET title = %s,
                description = %s,
                start_time = %s,
                end_time = %s,
                visibility = %s,
                updated_at = UTC_TIMESTAMP()
            WHERE contest_id = %s
            """,
            (
                title,
                description,
                _to_sql_datetime(start_time),
                _to_sql_datetime(end_time),
                visibility,
                contest_id,
            ),
        )
        problems = _extract_draft_problems(draft_payload)
        if problems is not None:
            _delete_draft_problems(cursor, contest_id)
            if problems:
                _persist_draft_problems_as_contest_problems(cursor, draft, problems)
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        updated_draft = cursor.fetchone()
        updated_draft = _attach_draft_problems(cursor, updated_draft)
        return Response({"message": "Draft updated successfully.", "draft": updated_draft}, status=200)
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsProblemSetter])
def publish_draft(request, contest_id):
    contest_id = str(contest_id)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        draft = _attach_draft_problems(cursor, draft)
        publish_error = _validate_publishable_draft(draft)
        if publish_error:
            return Response({"error": publish_error}, status=400)

        cursor.execute(
            """
            UPDATE contests
            SET visibility = 'public',
                updated_at = UTC_TIMESTAMP()
            WHERE contest_id = %s
            """,
            (contest_id,),
        )
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        return Response(
            {"message": "Draft published successfully.", "contest": cursor.fetchone()},
            status=201,
        )
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()



# to create a contest (problemsetter/user)

@api_view(["POST"])
@permission_classes([IsProblemSetter])
def create_contest(request):
    created_by = _get_request_user_external_id(request)
    if created_by is None:
        return Response({"error": "Authenticated user is not linked to a platform account."}, status=403)

    payload = dict(request.data)
    contest_data = dict(payload.get("contest", {}))
    contest_data["created_by"] = created_by
    payload["contest"] = contest_data

    serializer = ContestSerializer(data=payload)
    if serializer.is_valid():
        try:
            serializer.save()
            return Response(serializer.data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
    return Response(serializer.errors, status=400)


@api_view(["GET", "PUT"])
@permission_classes([IsProblemSetter])
def contest_metadata_detail(request, contest_id):
    contest_id = str(contest_id)

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()

        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        if not _can_manage_contest(request, contest):
            return Response({"error": "You do not have permission to edit this contest."}, status=403)

        if request.method == "GET":
            return Response({"contest": contest}, status=200)

        serializer = ContestInfoSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        validated = serializer.validated_data
        cursor.execute(
            """
            UPDATE contests
            SET title = %s,
                description = %s,
                start_time = %s,
                end_time = %s,
                visibility = %s,
                updated_at = UTC_TIMESTAMP()
            WHERE contest_id = %s
            """,
            (
                validated["title"],
                validated.get("description", ""),
                _to_sql_datetime(validated["start_time"]),
                _to_sql_datetime(validated["end_time"]),
                validated["visibility"],
                contest_id,
            ),
        )
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        updated_contest = cursor.fetchone()
        return Response({"message": "Contest details updated successfully.", "contest": updated_contest}, status=200)
    except Exception as e:
        if conn and conn.is_connected():
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if cursor is not None:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


# to delete a contest (problemsetter/user)

@api_view(["DELETE"])
@permission_classes([IsProblemSetterOwner]) 
def delete_contest(request, contest_id):
    contest_id = str(contest_id)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
     
        cursor.execute(
            "SELECT contest_id, title, created_by FROM contests WHERE contest_id = %s", 
            (contest_id,)
        )
        contest = cursor.fetchone()
        
        if not contest:
            return Response({"error": "Contest not found"}, status=404)

        if not _can_manage_contest(request, contest):
            return Response({"error": "You do not have permission to delete this contest."}, status=403)

        # Just delete the contest → CASCADE will handle the rest
        cursor.execute("DELETE FROM contests WHERE contest_id = %s", (contest_id,))
        conn.commit()

     

        return Response({
            "message": "Contest deleted successfully (including problems, participants, and submissions)",
            "status": 200
        }, status=200)

    except Exception as e:
        if 'conn' in locals() and conn and conn.is_connected():
            conn.rollback()
     
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

# getting all problems of a contest

@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_info(request,contest_id):
    contest_id = str(contest_id)
    user_id = _get_request_user_external_id(request)
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        result_contest = _fetch_contest_with_registration(cursor, contest_id, user_id)

        if not result_contest:
            return Response({"message":"Contest with this id doesn't exist","status":404}) 

        result_contest = _attach_creator_username(cursor, result_contest)

        if _contest_is_live(result_contest) and not result_contest.get("is_registered") and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)
        
        cursor.execute(
            """
            SELECT p.problem_id, p.title, p.description, p.difficulty, p.time_limit_ms,
                   p.memory_limit_kb, p.visibility, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s
            ORDER BY p.created_at ASC
            """,
            (contest_id,),
        )
        result_problem = cursor.fetchall()

        problem_ids = [str(problem["problem_id"]) for problem in result_problem]
        tags_by_problem = {problem_id: [] for problem_id in problem_ids}

        if problem_ids:
            placeholders = ", ".join(["%s"] * len(problem_ids))
            cursor.execute(
                f"""
                SELECT pt.problem_id, t.name
                FROM problem_tags pt
                JOIN tags t ON t.tag_id = pt.tag_id
                WHERE pt.problem_id IN ({placeholders})
                ORDER BY t.name ASC
                """,
                tuple(problem_ids),
            )
            for row in cursor.fetchall():
                tags_by_problem.setdefault(row["problem_id"], []).append(row["name"])

        serialized_payload = {
            "contest": result_contest,
            "problems": [
                {**problem, "problem_id": str(problem["problem_id"]), "tags": tags_by_problem.get(str(problem["problem_id"]), [])}
                for problem in result_problem
            ],
        }

        serializer = ContestSerializer(instance=serialized_payload)
        return Response({"data": serializer.data, "status": 200})
    except Exception as e:
        return Response({"error": str(e),"status":500})
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_registration_status(request, contest_id):
    contest_id = str(contest_id)
    user_id = _get_request_user_external_id(request)

    try:
        if user_id is None:
            return Response({"is_registered": False}, status=200)

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT EXISTS(
                SELECT 1
                FROM contest_participants
                WHERE contest_id = %s AND user_id = %s
            ) AS is_registered
            """,
            (contest_id, str(user_id)),
        )
        row = cursor.fetchone() or {}
        return Response({"is_registered": bool(row.get("is_registered"))}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([IsProblemSetter])
def get_contest_problem_editor_data(request, contest_id):
    contest_id = str(contest_id)
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        cursor.execute(
            """
            SELECT p.problem_id, p.title, p.slug, p.description, p.difficulty,
                   p.time_limit_ms, p.memory_limit_kb, p.visibility, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s
            ORDER BY p.created_at ASC
            """,
            (contest_id,),
        )
        problems = cursor.fetchall()

        problem_ids = [str(problem["problem_id"]) for problem in problems]
        tags_by_problem = {problem_id: [] for problem_id in problem_ids}
        testcases_by_problem = {problem_id: [] for problem_id in problem_ids}

        if problem_ids:
            placeholders = ", ".join(["%s"] * len(problem_ids))
            cursor.execute(
                f"""
                SELECT pt.problem_id, t.name
                FROM problem_tags pt
                JOIN tags t ON t.tag_id = pt.tag_id
                WHERE pt.problem_id IN ({placeholders})
                ORDER BY t.name ASC
                """,
                tuple(problem_ids),
            )
            for row in cursor.fetchall():
                tags_by_problem.setdefault(str(row["problem_id"]), []).append(row["name"])

            cursor.execute(
                f"""
                SELECT testcase_id, problem_id, input AS input_data,
                       expected_output AS output_data, NOT is_sample AS is_hidden
                FROM testcases
                WHERE problem_id IN ({placeholders})
                ORDER BY created_at ASC
                """,
                tuple(problem_ids),
            )
            for row in cursor.fetchall():
                row["problem_id"] = str(row["problem_id"])
                row["testcase_id"] = str(row["testcase_id"])
                testcases_by_problem.setdefault(row["problem_id"], []).append({
                    "testcase_id": row["testcase_id"],
                    "input_data": row.get("input_data", ""),
                    "output_data": row.get("output_data", ""),
                    "is_hidden": bool(row.get("is_hidden", True)),
                })

        payload = {
            "contest": contest,
            "problems": [
                {
                    **problem,
                    "problem_id": str(problem["problem_id"]),
                    "tags": tags_by_problem.get(str(problem["problem_id"]), []),
                    "testcases": testcases_by_problem.get(str(problem["problem_id"]), []),
                }
                for problem in problems
            ],
        }
        return Response({"data": payload, "status": 200})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_problem_solving_data(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)
    user_id = _get_request_user_external_id(request)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        contest = _fetch_contest_with_registration(cursor, contest_id, user_id)
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        if _contest_is_live(contest) and not contest.get("is_registered") and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            """
            SELECT p.problem_id, p.title, p.slug, p.description, p.difficulty,
                   p.time_limit_ms, p.memory_limit_kb, p.visibility, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s AND cp.problem_id = %s
            LIMIT 1
            """,
            (contest_id, problem_id),
        )
        problem = cursor.fetchone()
        if not problem:
            return Response({"error": "Problem not found in this contest."}, status=404)

        cursor.execute(
            """
            SELECT t.name
            FROM problem_tags pt
            JOIN tags t ON t.tag_id = pt.tag_id
            WHERE pt.problem_id = %s
            ORDER BY t.name ASC
            """,
            (problem_id,),
        )
        tags = [row["name"] for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT testcase_id, input AS input_data, expected_output AS output_data
            FROM testcases
            WHERE problem_id = %s AND is_sample = TRUE
            ORDER BY created_at ASC
            """,
            (problem_id,),
        )
        visible_testcases = [
            {
                "testcase_id": str(row["testcase_id"]),
                "input_data": row.get("input_data", ""),
                "output_data": row.get("output_data", ""),
            }
            for row in cursor.fetchall()
        ]

        cursor.execute(
            """
            SELECT COUNT(*) AS hidden_count
            FROM testcases
            WHERE problem_id = %s AND is_sample = FALSE
            """,
            (problem_id,),
        )
        hidden_testcases = cursor.fetchone() or {"hidden_count": 0}

        cursor.execute(
            """
            SELECT language_id, name
            FROM languages
            ORDER BY name ASC
            """
        )
        languages = [
            {"language_id": row["language_id"], "name": row["name"]}
            for row in cursor.fetchall()
        ]

        cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   l.name AS language_name, s.source_code, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            WHERE s.contest_id = %s AND s.problem_id = %s
            ORDER BY s.submitted_at DESC
            LIMIT 25
            """,
            (contest_id, problem_id),
        )
        submissions = [_serialize_submission_row(row) for row in cursor.fetchall()]

        payload = {
            "contest": contest,
            "problem": {
                **problem,
                "problem_id": str(problem["problem_id"]),
                "tags": tags,
            },
            "visible_testcases": visible_testcases,
            "hidden_testcase_count": hidden_testcases["hidden_count"],
            "languages": languages,
            "submissions": submissions,
        }
        return Response({"data": payload, "status": 200})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["PUT"])
@permission_classes([IsProblemSetter])
def update_contest_problem(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)

    serializer = ProblemManageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    validated = serializer.validated_data

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, start_time
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        cursor.execute(
            """
            SELECT 1
            FROM contest_problems
            WHERE contest_id = %s AND problem_id = %s
            LIMIT 1
            """,
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        cursor.execute(
            """
            UPDATE problems
            SET title = %s,
                slug = %s,
                description = %s,
                difficulty = %s,
                time_limit_ms = %s,
                memory_limit_kb = %s,
                visibility = %s,
                updated_at = UTC_TIMESTAMP()
            WHERE problem_id = %s
            """,
            (
                validated["title"],
                validated["slug"],
                validated.get("description", ""),
                validated["difficulty"],
                validated["time_limit_ms"],
                validated["memory_limit_kb"],
                validated["visibility"],
                problem_id,
            ),
        )

        cursor.execute(
            """
            UPDATE contest_problems
            SET max_score = %s
            WHERE contest_id = %s AND problem_id = %s
            """,
            (validated["max_score"], contest_id, problem_id),
        )

        cursor.execute("DELETE FROM problem_tags WHERE problem_id = %s", (problem_id,))
        for tag_name in validated.get("tags", []):
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s LIMIT 1", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    """
                    INSERT IGNORE INTO problem_tags (problem_id, tag_id)
                    VALUES (%s, %s)
                    """,
                    (problem_id, tag_row["tag_id"]),
                )

        cursor.execute("DELETE FROM testcases WHERE problem_id = %s", (problem_id,))
        for testcase in validated.get("testcases", []):
            cursor.execute(
                """
                INSERT INTO testcases (testcase_id, problem_id, input, expected_output, is_sample)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    str(testcase.get("testcase_id") or uuid.uuid4()),
                    problem_id,
                    testcase.get("input_data", ""),
                    testcase.get("output_data", ""),
                    not testcase.get("is_hidden", True),
                ),
            )

        conn.commit()
        return Response({"message": "Problem updated successfully.", "status": 200}, status=200)
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsProblemSetter])
def create_contest_problem(request, contest_id):
    contest_id = str(contest_id)

    serializer = ProblemManageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    validated = serializer.validated_data

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, created_by
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        problem_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO problems
            (problem_id, title, slug, description, difficulty, time_limit_ms,
             memory_limit_kb, visibility, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                problem_id,
                validated["title"],
                validated["slug"],
                validated.get("description", ""),
                validated["difficulty"],
                validated["time_limit_ms"],
                validated["memory_limit_kb"],
                validated["visibility"],
                contest.get("created_by"),
            ),
        )

        cursor.execute(
            """
            INSERT INTO contest_problems (contest_id, problem_id, max_score)
            VALUES (%s, %s, %s)
            """,
            (contest_id, problem_id, validated["max_score"]),
        )

        cursor.execute("DELETE FROM problem_tags WHERE problem_id = %s", (problem_id,))
        for tag_name in validated.get("tags", []):
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s LIMIT 1", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    """
                    INSERT IGNORE INTO problem_tags (problem_id, tag_id)
                    VALUES (%s, %s)
                    """,
                    (problem_id, tag_row["tag_id"]),
                )

        for testcase in validated.get("testcases", []):
            cursor.execute(
                """
                INSERT INTO testcases (testcase_id, problem_id, input, expected_output, is_sample)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    str(testcase.get("testcase_id") or uuid.uuid4()),
                    problem_id,
                    testcase.get("input_data", ""),
                    testcase.get("output_data", ""),
                    not testcase.get("is_hidden", True),
                ),
            )

        conn.commit()

        response_problem = {
            "problem_id": problem_id,
            "title": validated["title"],
            "slug": validated["slug"],
            "description": validated.get("description", ""),
            "difficulty": validated["difficulty"],
            "time_limit_ms": validated["time_limit_ms"],
            "memory_limit_kb": validated["memory_limit_kb"],
            "visibility": validated["visibility"],
            "max_score": validated["max_score"],
            "tags": validated.get("tags", []),
            "testcases": validated.get("testcases", []),
        }
        return Response({"message": "Problem created successfully.", "problem": response_problem}, status=201)
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_problem_submission(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)

    source_code = str(request.data.get("source_code", "") or "")
    requested_language_id = request.data.get("language_id")
    requested_language_name = str(request.data.get("language_name", "") or "").strip()

    if not source_code.strip():
        return Response({"error": "Source code is required."}, status=400)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, start_time
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        external_user_id = _get_request_user_external_id(request)
        cursor.execute(
            """
            SELECT 1
            FROM contest_participants
            WHERE contest_id = %s AND user_id = %s
            LIMIT 1
            """,
            (contest_id, str(external_user_id) if external_user_id is not None else None),
        )
        is_registered = bool(cursor.fetchone())
        if _contest_is_live(contest) and not is_registered and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            """
            SELECT 1
            FROM contest_problems
            WHERE contest_id = %s AND problem_id = %s
            LIMIT 1
            """,
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        cursor.execute(
            """
            SELECT language_id, name
            FROM languages
            ORDER BY name ASC
            """
        )
        languages = [
            {"language_id": row["language_id"], "name": row["name"]}
            for row in cursor.fetchall()
        ]
        selected_language_id = None

        if requested_language_id is not None:
            cursor.execute(
                """
                SELECT language_id
                FROM languages
                WHERE language_id = %s
                LIMIT 1
                """,
                (requested_language_id,),
            )
            row = cursor.fetchone()
            if row:
                selected_language_id = row["language_id"]

        if selected_language_id is None and requested_language_name:
            cursor.execute(
                "INSERT IGNORE INTO languages (name) VALUES (%s)",
                (requested_language_name,),
            )
            cursor.execute(
                """
                SELECT language_id
                FROM languages
                WHERE name = %s
                LIMIT 1
                """,
                (requested_language_name,),
            )
            row = cursor.fetchone()
            if row:
                selected_language_id = row["language_id"]

        if selected_language_id is None and languages:
            selected_language_id = languages[0]["language_id"]

        submission_id = str(uuid.uuid4())
        user_id = _get_request_user_external_id(request)

        cursor.execute(
            """
            INSERT INTO Submissions
            (submission_id, user_id, problem_id, contest_id, language_id, source_code,
             verdict, status, max_execution_time_ms, max_memory_used_kb)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                submission_id,
                user_id,
                problem_id,
                contest_id,
                selected_language_id,
                source_code,
                "Pending",
                "In_Queue",
                None,
                None,
            ),
        )

        cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   l.name AS language_name, s.source_code, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            WHERE s.submission_id = %s
            LIMIT 1
            """,
            (submission_id,),
        )
        submission = cursor.fetchone()
        conn.commit()

        return Response(
            {
                "data": _serialize_submission_row(submission),
                "message": "Submission queued successfully.",
                "status": 201,
            },
            status=201,
        )
    except Exception as e:
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


#  creating editorial for a contest 
@api_view(["POST"])
@permission_classes([IsProblemSetterOwner])
def create_editorial(request):
    serializer=EditorialSerializer(data=request.data)
    if serializer.is_valid():
        try:
            serializer.save(created_by=_get_request_user_external_id(request))
            return Response({"message":"Editorial created successfully","status":200})
        except Exception as e:
            return Response({"error": str(e),"status":500})
    return Response(serializer.errors,status=400)



# view/get  the editorial of a contest 
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_editorial(request,problem_id):
    try :
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM editorials WHERE problem_id=%s",(problem_id,))
        result=cursor.fetchone()
        if not result:
            return Response({"message":"Editorial not found","status":404})
        return Response({"editorial":result,"status":200})
    except Exception as e:
        return Response({"error":str(e),"status":500})
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_submissions(request):
    user_id = _get_request_user_external_id(request)
    if user_id is None:
        return Response({"error": "Authenticated user is not linked to a platform account."}, status=403)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id, s.source_code,
                l.name AS language_name, s.status, s.verdict,
                s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at,
                p.title as problem_title,
                c.title as contest_title
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            LEFT JOIN problems p ON p.problem_id = s.problem_id
            LEFT JOIN contests c ON c.contest_id = s.contest_id
            WHERE s.user_id = %s
            ORDER BY s.submitted_at DESC
            LIMIT 100
            """,
            (str(user_id),),
        )
        submissions = cursor.fetchall()
        serialized_submissions = []
        for row in submissions:
            serialized = _serialize_submission_row(row)
            serialized['problem_title'] = row.get('problem_title')
            serialized['contest_title'] = row.get('contest_title')
            serialized_submissions.append(serialized)

        return Response(serialized_submissions, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_submission(request, submission_id):
    user_id = _get_request_user_external_id(request)
    if user_id is None:
        return Response({"error": "Authenticated user is not linked to a platform account."}, status=403)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT
                s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id, s.source_code,
                l.name AS language_name, s.status, s.verdict,
                s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at,
                p.title as problem_title,
                c.title as contest_title
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            LEFT JOIN problems p ON p.problem_id = s.problem_id
            LEFT JOIN contests c ON c.contest_id = s.contest_id
            WHERE s.submission_id = %s AND s.user_id = %s
            LIMIT 1
            """,
            (str(submission_id), str(user_id)),
        )
        submission = cursor.fetchone()
        if not submission:
            return Response({"error": "Submission not found or you do not have permission to view it."}, status=404)
        serialized = _serialize_submission_row(submission)
        serialized['problem_title'] = submission.get('problem_title')
        serialized['contest_title'] = submission.get('contest_title')
        return Response(serialized, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_participant(request, contest_id):
    contest_id = str(contest_id)
    user_id = _get_request_user_external_id(request)
    if user_id is None:
        return Response({"error": "Authenticated user is not linked to a platform account.", "status": 403}, status=403)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, start_time
            FROM contests
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found.", "status": 404}, status=404)

        if _contest_is_live(contest) and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            """
            INSERT INTO contest_participants (contest_id, user_id)
            VALUES (%s, %s)
            """,
            (contest_id, str(user_id)),
        )
        conn.commit()

        return Response({"message": "Registered successfully", "status": 201}, status=201)
    
    except Exception as e:
        # MySQL error for duplicate entry is 1062
        if 'Duplicate entry' in str(e):
            return Response({"message": "You are already registered for this contest."}, status=409)
        return Response({"error": str(e), "status": 500}, status=500)
    
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

@api_view(["GET"])
@permission_classes([AllowAny])
def active_contests(request):
    try:
        activeContests=get_active_contests_data()
        return  Response(activeContests)

    except Exception as e:
            return Response({"error": str(e)}, status=500)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_solution(request, contest_id, problem_id):
    source_code = request.data.get("source_code")
    language_id = request.data.get("language_id")

    if not source_code or not language_id:
        return Response({"error": "source_code and language_id are required in the payload."}, status=400)

    user_id = _get_request_user_external_id(request)

    conn = get_connection()
    cursor = conn.cursor()

    try:
        # Verify the problem belongs to the given contest
        cursor.execute("""
            SELECT 1 FROM contest_problems 
            WHERE contest_id = %s AND problem_id = %s
        """, (str(contest_id), str(problem_id)))
        
        if not cursor.fetchone():
            return Response({"error": "Problem not found in this contest."}, status=404)

        # Generate UUID for submission
        cursor.execute("SELECT UUID()")
        submission_id = cursor.fetchone()[0]

        cursor.execute("""
            INSERT INTO Submissions(submission_id, user_id, problem_id, contest_id, language_id, source_code, submitted_at, status, verdict)
            VALUES(%s, %s, %s, %s, %s, %s, NOW(), 'In_Queue', 'Pending')
        """, (submission_id, user_id, str(problem_id), str(contest_id), language_id, source_code))

        conn.commit()
        
        # Trigger judge 
        judge_submission(submission_id)

        # Fetch the created submission to return to the frontend
        dict_cursor = conn.cursor(dictionary=True)
        dict_cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   l.name AS language_name, s.source_code, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            WHERE s.submission_id = %s
            LIMIT 1
            """,
            (submission_id,),
        )
        submission_row = dict_cursor.fetchone()
        dict_cursor.close()
        
        return Response({
            "message": "Submission recorded and sent to judge successfully.", 
            "submission_id": submission_id,
            "data": _serialize_submission_row(submission_row) if submission_row else None
        }, status=201)

    except Exception as e:
        if conn and conn.is_connected():
            conn.rollback()
        return Response({
            "error": "An internal error occurred during submission.", 
            "details": str(e)
        }, status=500)
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()
