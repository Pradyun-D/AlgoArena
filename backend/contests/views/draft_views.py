import uuid

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsProblemSetter
from db import get_connection
from ._helpers import (
    _get_request_user_external_id,
    _parse_optional_datetime,
    _to_sql_datetime,
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
            SELECT contest_id, title, description, start_time, end_time,
                   visibility, created_by, created_at, updated_at
            FROM drafts
            ORDER BY updated_at DESC, created_at DESC
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
    visibility = str(draft_payload.get("visibility", "public") or "public").strip()
    if visibility not in ("public", "private"):
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
            FROM drafts WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
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
            FROM drafts WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        if request.method == "GET":
            return Response({"draft": draft}, status=200)

        # PUT – update the draft
        draft_payload = dict(request.data.get("contest", request.data) or {})
        title = str(draft_payload.get("title", "") or "").strip() or "Untitled Draft"
        description = str(draft_payload.get("description", "") or "").strip()
        visibility = str(draft_payload.get("visibility", draft.get("visibility", "public")) or "public").strip()
        if visibility not in ("public", "private"):
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
            (title, description, _to_sql_datetime(start_time), _to_sql_datetime(end_time), visibility, contest_id),
        )
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM drafts WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        updated_draft = cursor.fetchone()
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

        # Fetch from drafts table
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at, updated_at
            FROM drafts WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        draft = cursor.fetchone()
        if not draft:
            return Response({"error": "Draft not found."}, status=404)

        # Validate (problem_count not required since problems added via editor post-publish)
        title = str(draft.get("title") or "").strip()
        description = str(draft.get("description") or "").strip()
        start_time = draft.get("start_time")
        end_time = draft.get("end_time")

        if not title or title == "Untitled Draft":
            return Response({"error": "Add a real contest title before publishing this draft."}, status=400)
        if not description:
            return Response({"error": "Add a contest description before publishing this draft."}, status=400)
        if start_time is None or end_time is None:
            return Response({"error": "Set both start and end time before publishing this draft."}, status=400)
        if start_time >= end_time:
            return Response({"error": "End time must occur after start time."}, status=400)

        # Generate a new contest_id for the published contest
        new_contest_id = str(uuid.uuid4())

        # Insert into contests table as public
        cursor.execute(
            """
            INSERT INTO contests
            (contest_id, title, description, start_time, end_time, visibility, created_by)
            VALUES (%s, %s, %s, %s, %s, 'public', %s)
            """,
            (
                new_contest_id,
                draft["title"],
                draft["description"],
                draft["start_time"],
                draft["end_time"],
                draft["created_by"],
            ),
        )

        # Delete from drafts table
        cursor.execute("DELETE FROM drafts WHERE contest_id = %s", (contest_id,))
        conn.commit()

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility, created_at
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (new_contest_id,),
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
