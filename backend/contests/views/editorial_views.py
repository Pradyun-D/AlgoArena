from rest_framework.decorators import api_view, permission_classes
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
            return Response({"message": "Editorial created successfully", "status": 200})
        except Exception as e:
            return Response({"error": str(e), "status": 500})
    return Response(serializer.errors, status=400)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_editorial(request, problem_id):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM editorials WHERE problem_id = %s", (problem_id,))
        result = cursor.fetchone()
        if not result:
            return Response({"message": "Editorial not found", "status": 404})
        return Response({"editorial": result, "status": 200})
    except Exception as e:
        return Response({"error": str(e), "status": 500})
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()