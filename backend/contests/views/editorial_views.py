from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsProblemSetterOwner, IsAuthenticated
from db import get_connection
from .contest_serializer import EditorialSerializer
from ._helpers import _get_request_user_external_id


@api_view(["POST"])
@permission_classes([IsProblemSetterOwner])
def create_editorial(request):
    serializer = EditorialSerializer(data=request.data)
    if serializer.is_valid():
        try:
            serializer.save(created_by=_get_request_user_external_id(request))
            return Response({"message": "Editorial created successfully"}, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
    return Response(serializer.errors, status=400)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_editorial(request, problem_id):
    """
    Returns editorial for a problem.
    - Privileged users (problem_setter / admin): always allowed.
    - All others (authenticated or anonymous): allowed only after the contest ends.
    """
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        # Determine whether the requesting user is privileged
        user_role = getattr(request.user, "role", None)
        is_privileged = user_role in ("problem_setter", "admin")

        if not is_privileged:
            # Cross-reference the problem to find its contest's end time
            cursor.execute(
                """
                SELECT c.end_time
                FROM contests c
                JOIN contest_problems cp ON c.contest_id = cp.contest_id
                WHERE cp.problem_id = %s
                LIMIT 1
                """,
                (str(problem_id),),
            )
            contest_data = cursor.fetchone()

            if not contest_data:
                return Response({"error": "Problem or contest not found."}, status=404)

            # Compare against the DB's own UTC clock to avoid time-zone drift
            cursor.execute("SELECT UTC_TIMESTAMP() as now")
            now_row = cursor.fetchone()

            if contest_data["end_time"] > now_row["now"]:
                return Response(
                    {"error": "Editorial is locked until the contest ends."},
                    status=403,
                )

        cursor.execute(
            "SELECT * FROM editorials WHERE problem_id = %s", (str(problem_id),)
        )
        result = cursor.fetchone()
        if not result:
            return Response({"message": "Editorial not found."}, status=404)
        return Response({"editorial": result}, status=200)

    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["PATCH"])
@permission_classes([IsProblemSetterOwner])
def update_editorial(request, problem_id):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM editorials WHERE problem_id = %s", (str(problem_id),))
        existing = cursor.fetchone()
        if not existing:
            return Response({"error": "Editorial not found."}, status=404)

        content = request.data.get("content", "").strip()
        if not content:
            return Response({"error": "Content must not be empty."}, status=400)

        cursor.execute(
            "UPDATE editorials SET content = %s, updated_at = UTC_TIMESTAMP() WHERE problem_id = %s",
            (content, str(problem_id)),
        )
        conn.commit()
        cursor.execute("SELECT * FROM editorials WHERE problem_id = %s", (str(problem_id),))
        return Response({"message": "Editorial updated successfully.", "editorial": cursor.fetchone()}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()