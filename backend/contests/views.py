from django.contrib.auth.models import PermissionManager
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import redirect
from datetime import datetime, timezone
import uuid
from accounts.permissions import IsProblemSetter, IsAdmin,IsProblemSetterOwner,IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response    
from .contest_serializer import ContestSerializer, EditorialSerializer, ProblemManageSerializer
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


def _ensure_default_languages(cursor):
    default_languages = ["C++20", "Python 3.11", "Java 17"]

    for language_name in default_languages:
        cursor.execute(
            "INSERT IGNORE INTO languages (name) VALUES (%s)",
            (language_name,),
        )

    cursor.execute(
        """
        SELECT language_id, name
        FROM languages
        ORDER BY language_id ASC
        """
    )

    return [
        {
            "language_id": row["language_id"],
            "name": row["name"],
        }
        for row in cursor.fetchall()
    ]


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


def _contest_has_started(contest):
    start_time = contest.get("start_time") if contest else None
    if start_time is None:
        return True
    return start_time <= datetime.utcnow()


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

    return None



def _get_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility, created_by, created_at
            FROM contests WHERE end_time > UTC_TIMESTAMP()
            ORDER BY start_time ASC, created_at DESC
            """
        )
        return cursor.fetchall()  
    except Exception as e:
            return Response({"error": str(e)}, status=500)  
    finally:
        cursor.close()
        conn.close()


def _get_past_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility, created_by, created_at
            FROM contests WHERE end_time <= UTC_TIMESTAMP()
            ORDER BY end_time DESC, created_at DESC
            """
        )
        return cursor.fetchall()
    except Exception as e:
            return Response({"error": str(e)}, status=500)
    finally:
        cursor.close()
        conn.close()

def get_active_contests_data():
    conn=get_connection()
    cursor=conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT UTC_TIMESTAMP() AS now_utc")
        print("db now utc:", cursor.fetchone())

        cursor.execute("""
        SELECT contest_id, title, start_time, end_time
        FROM contests
        ORDER BY created_at DESC
        """)
        print("all contests:", cursor.fetchall())

        rows=cursor.fetchall()
        print(rows)
        return rows
    finally:
        cursor.close()
        conn.close()


# to get all contests

@api_view(["GET"])
@permission_classes([AllowAny])
def all_contests(request):
    return Response(_get_contests_data())


@api_view(["GET"])
@permission_classes([AllowAny])
def past_contests(request):
    return Response(_get_past_contests_data())


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_dashboard_contests(request):
    return Response(_get_contests_data())


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_dashboard_active_contests(request):
    return Response(get_active_contests_data())


@api_view(["GET"])
@permission_classes([IsProblemSetter])
def list_drafts(request):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM drafts
            ORDER BY updated_at DESC, created_at DESC
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
    visibility = str(draft_payload.get("visibility", "public") or "public").strip().lower()
    if visibility not in {"public", "private"}:
        visibility = "public"

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
            INSERT INTO drafts
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

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM drafts
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        return Response(
            {"message": "Draft saved successfully.", "draft": cursor.fetchone()},
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
            FROM drafts
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        if request.method == "GET":
            return Response({"draft": draft}, status=200)

        draft_payload = dict(request.data.get("contest", request.data) or {})
        title = str(draft_payload.get("title", "") or "").strip() or "Untitled Draft"
        description = str(draft_payload.get("description", "") or "").strip()
        visibility = str(draft_payload.get("visibility", draft.get("visibility", "public")) or "public").strip().lower()
        if visibility not in {"public", "private"}:
            visibility = "public"

        try:
            start_time = _parse_optional_datetime(draft_payload.get("start_time"))
            end_time = _parse_optional_datetime(draft_payload.get("end_time"))
        except ValueError as e:
            return Response({"error": str(e)}, status=400)

        if start_time and end_time and start_time >= end_time:
            return Response({"error": "End time must occur after start time."}, status=400)

        cursor.execute(
            """
            UPDATE drafts
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
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM drafts
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        return Response({"message": "Draft updated successfully.", "draft": cursor.fetchone()}, status=200)
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
            FROM drafts
            WHERE contest_id = %s
            LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        publish_error = _validate_publishable_draft(draft)
        if publish_error:
            return Response({"error": publish_error}, status=400)

        cursor.execute(
            """
            INSERT INTO contests
            (contest_id, title, description, start_time, end_time, visibility, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (
                draft["contest_id"],
                draft["title"],
                draft.get("description", ""),
                draft.get("start_time"),
                draft.get("end_time"),
                draft.get("visibility", "public"),
                draft.get("created_by"),
            ),
        )
        cursor.execute("DELETE FROM drafts WHERE contest_id = %s", (contest_id,))
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


# to delete a contest (problemsetter/user)


@api_view(["DELETE"])
@permission_classes([IsProblemSetterOwner]) 
def delete_contest(request,contest_id):
    contest_id = str(contest_id)

    # checking if present in db 
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM contests WHERE contest_id=%s",(contest_id,))
        result=cursor.fetchone()
        if not result:
            return Response({"error":"Contest not found","status":404})
    
    # deleting from db
        cursor.execute("DELETE FROM contests WHERE contest_id=%s",(contest_id,))
        conn.commit()
        return Response({"message":"Contest deleted successfully","status":200})
    except Exception as e:
        return Response({"error": str(e),"status":500})
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
        result_contest=cursor.fetchone()

        if not result_contest:
            return Response({"message":"Contest with this id doesn't exist","status":200}) 
        
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
        if not _contest_has_started(contest):
            return Response({"error": "Problem solving is locked until the contest starts."}, status=403)

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

        languages = _ensure_default_languages(cursor)

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
        if not _contest_has_started(contest):
            return Response({"error": "Submissions are locked until the contest starts."}, status=403)

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
@permission_classes([AllowAny])
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
            SELECT 1
            FROM contest_problems
            WHERE contest_id = %s AND problem_id = %s
            LIMIT 1
            """,
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        languages = _ensure_default_languages(cursor)
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
            INSERT INTO contest_participants (contest_id, user_id)
            VALUES (%s, %s)
            """,
            (contest_id, user_id),
        )
        conn.commit()

        return Response({"message": "Registered successfully", "status": 201}, status=201)
    
    except Exception as e:
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

    user_id = request.user.id

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
        
        return Response({
            "message": "Submission recorded and sent to judge successfully.", 
            "submission_id": submission_id
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
