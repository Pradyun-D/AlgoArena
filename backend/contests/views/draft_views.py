import uuid

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsProblemSetter
from db import get_connection
from ._helpers import (
    _get_request_user_external_id,
    _parse_optional_datetime,
    _to_sql_datetime,
    _extract_draft_problems,
    _persist_draft_problems_as_contest_problems,
    _attach_draft_problems,
    _delete_draft_problems,
    _validate_publishable_draft,
)


@api_view(["GET"])
@permission_classes([IsProblemSetter])
def list_drafts(request):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT c.contest_id, c.title, c.description, c.start_time, c.end_time,
                   c.visibility, c.created_by, c.created_at, c.updated_at,
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
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
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
                "private",
                created_by,
            ),
        )
        conn.commit()

        problems = _extract_draft_problems(draft_payload) or []
        if problems:
            _persist_draft_problems_as_contest_problems(
                cursor, {"contest_id": contest_id, "created_by": created_by}, problems
            )
            conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        draft["problems"] = problems
        draft["problem_count"] = len(problems)
        return Response({"message": "Draft saved successfully.", "draft": draft}, status=201)
    except Exception as e:
        if "conn" in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
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
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        draft = _attach_draft_problems(cursor, draft)

        if request.method == "GET":
            return Response({"draft": draft}, status=200)

        # PUT – update the draft
        draft_payload = dict(request.data.get("contest", request.data) or {})
        title = str(draft_payload.get("title", "") or "").strip() or "Untitled Draft"
        description = str(draft_payload.get("description", "") or "").strip()

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
                visibility = 'private',
                updated_at = UTC_TIMESTAMP()
            WHERE contest_id = %s
            """,
            (title, description, _to_sql_datetime(start_time), _to_sql_datetime(end_time), contest_id),
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
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        updated_draft = _attach_draft_problems(cursor, cursor.fetchone())
        return Response({"message": "Draft updated successfully.", "draft": updated_draft}, status=200)
    except Exception as e:
        if "conn" in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
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
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        cursor.execute(
            """
            SELECT COUNT(*) AS problem_count
            FROM contest_problems
            WHERE contest_id = %s
            """,
            (contest_id,),
        )
        problem_count_row = cursor.fetchone() or {}
        draft["problem_count"] = int(problem_count_row.get("problem_count") or 0)

        publish_error = _validate_publishable_draft(draft)
        if publish_error:
            return Response({"error": publish_error}, status=400)

        cursor.execute(
            """
            UPDATE contests
            SET visibility = 'public', updated_at = UTC_TIMESTAMP()
            WHERE contest_id = %s
            """,
            (contest_id,),
        )
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        return Response(
            {"message": "Draft published successfully.", "contest": cursor.fetchone()},
            status=201,
        )
    except Exception as e:
        if "conn" in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()
