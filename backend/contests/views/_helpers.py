from datetime import datetime, timezone
from db import get_connection


# ─────────────────────────── sidebar helpers ────────────────────────────────

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
        preferences.get("problems_solved", 0),
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


# ─────────────────────────── auth / permission helpers ──────────────────────

def _get_request_user_external_id(request):
    if not getattr(request.user, "is_authenticated", False):
        return None
    return getattr(request.user, "external_user_id", None)


def _can_view_private_contests(request):
    return getattr(request.user, "role", None) in {"admin", "problem_setter"}


def _is_privileged_contest_user(request):
    return getattr(request.user, "role", None) in {"admin", "problem_setter"}


def _can_manage_contest(request, contest_row):
    if getattr(request.user, "role", None) == "admin":
        return True
    owner_id = getattr(request.user, "external_user_id", None)
    if owner_id is None:
        return False
    return contest_row.get("created_by") == owner_id


# ─────────────────────────── datetime helpers ───────────────────────────────

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


# ─────────────────────────── contest DB helpers ─────────────────────────────

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
            ) AS is_registered,
            COALESCE((
                SELECT SUM(score)
                FROM contest_problem_scores cps
                WHERE cps.contest_id = c.contest_id
                  AND cps.user_id = %s
            ), 0) AS user_total_score
        FROM contests c
        WHERE c.contest_id = %s
        LIMIT 1
        """,
        (str(user_id) if user_id is not None else None, user_id, contest_id),
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
            "SELECT username FROM `user` WHERE user_id = %s LIMIT 1",
            (created_by,),
        )
        user_row = cursor.fetchone() or {}
        contest_row["created_by_username"] = user_row.get("username")
    except Exception:
        contest_row["created_by_username"] = None

    return contest_row


# ─────────────────────────── draft helpers ──────────────────────────────────

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

    problem_ids = [str(p["problem_id"]) for p in problems]
    tags_by_problem = {pid: [] for pid in problem_ids}

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
        "SELECT problem_id FROM contest_problems WHERE contest_id = %s",
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
    import uuid

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
            "INSERT INTO contest_problems (contest_id, problem_id, max_score) VALUES (%s, %s, %s)",
            (draft["contest_id"], problem_id, problem.get("max_score")),
        )

        for tag_name in normalized_tags:
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    "INSERT IGNORE INTO problem_tags (problem_id, tag_id) VALUES (%s, %s)",
                    (problem_id, tag_row["tag_id"]),
                )

        saved_problem = dict(problem)
        saved_problem["problem_id"] = problem_id
        saved_problem["tags"] = normalized_tags
        saved_problems.append(saved_problem)

    return saved_problems


# ─────────────────────────── submission helpers ─────────────────────────────

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


# ─────────────────────────── contest data queries ───────────────────────────

def _get_contests_data(user_id=None, include_private=False):
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
                    WHEN start_time > UTC_TIMESTAMP() THEN 'Scheduled'
                    WHEN end_time <= UTC_TIMESTAMP() THEN 'Completed'
                    ELSE 'Live'
                END AS status,
                COALESCE((
                    SELECT COUNT(*)
                    FROM contest_participants cp
                    WHERE cp.contest_id = contests.contest_id
                ), 0) AS participants_count,
                COALESCE((
                    SELECT SUM(score)
                    FROM contest_problem_scores cps
                    WHERE cps.contest_id = contests.contest_id AND cps.user_id = %s
                ), 0) AS user_total_score
            FROM contests
            """
            + visibility_clause
            + """
            ORDER BY start_time ASC, created_at ASC
            """,
            (user_id,),
        )
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching contests:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def _get_past_contests_data(user_id=None):
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
                ), 0) AS participants_count,
                COALESCE((
                    SELECT SUM(score)
                    FROM contest_problem_scores cps
                    WHERE cps.contest_id = contests.contest_id AND cps.user_id = %s
                ), 0) AS user_total_score
            FROM contests
            WHERE end_time <= UTC_TIMESTAMP()
            ORDER BY end_time DESC, created_at DESC
            """,
            (user_id,),
        )
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching past contests:", e)
        return []
    finally:
        cursor.close()
        conn.close()


def get_active_contests_data(user_id=None):
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
                CASE
                    WHEN start_time > UTC_TIMESTAMP() THEN 'Scheduled'
                    WHEN end_time <= UTC_TIMESTAMP() THEN 'Completed'
                    ELSE 'Live'
                END AS status,
                COALESCE((
                    SELECT COUNT(*)
                    FROM contest_participants cp
                    WHERE cp.contest_id = contests.contest_id
                ), 0) AS participants_count,
                COALESCE((
                    SELECT SUM(score)
                    FROM contest_problem_scores cps
                    WHERE cps.contest_id = contests.contest_id AND cps.user_id = %s
                ), 0) AS user_total_score
            FROM contests
            WHERE start_time <= UTC_TIMESTAMP()
              AND end_time > UTC_TIMESTAMP()
            ORDER BY end_time DESC, created_at DESC
            """,
            (user_id,),
        )
        return cursor.fetchall()
    except Exception as e:
        print("Error fetching active contests:", e)
        return []
    finally:
        cursor.close()
        conn.close()