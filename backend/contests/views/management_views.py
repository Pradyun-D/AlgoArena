from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsProblemSetter, IsProblemSetterOwner
from db import get_connection
from .contest_serializer import ContestSerializer, ContestInfoSerializer
from ._helpers import (
    _get_request_user_external_id,
    _can_manage_contest,
    _to_sql_datetime,
)


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
            FROM contests WHERE contest_id = %s LIMIT 1
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
            FROM contests WHERE contest_id = %s LIMIT 1
            """,
            (contest_id,),
        )
        return Response(
            {"message": "Contest details updated successfully.", "contest": cursor.fetchone()},
            status=200,
        )
    except Exception as e:
        if conn and conn.is_connected():
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if cursor is not None:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


@api_view(["DELETE"])
@permission_classes([IsProblemSetterOwner])
def delete_contest(request, contest_id):
    contest_id = str(contest_id)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            "SELECT contest_id, title, created_by FROM contests WHERE contest_id = %s",
            (contest_id,),
        )
        contest = cursor.fetchone()
        deleted_from = "contests"

        if contest:
            if not _can_manage_contest(request, contest):
                return Response({"error": "You do not have permission to delete this contest."}, status=403)

            cursor.execute("DELETE FROM contests WHERE contest_id = %s", (contest_id,))
        else:
            cursor.execute(
                "SELECT contest_id, title, created_by FROM drafts WHERE contest_id = %s",
                (contest_id,),
            )
            draft = cursor.fetchone()
            if not draft:
                return Response({"error": "Contest not found"}, status=404)

            if not _can_manage_contest(request, draft):
                return Response({"error": "You do not have permission to delete this draft."}, status=403)

            deleted_from = "drafts"
            cursor.execute("DELETE FROM drafts WHERE contest_id = %s", (contest_id,))

        conn.commit()
        return Response(
            {
                "message": (
                    "Draft deleted successfully." if deleted_from == "drafts"
                    else "Contest deleted successfully (including problems, participants, and submissions)"
                ),
                "status": 200,
            },
            status=200,
        )
    except Exception as e:
        if "conn" in locals() and conn and conn.is_connected():
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()
