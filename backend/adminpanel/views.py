from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.auth_sync import sync_django_user_from_external_row
from accounts.permissions import IsAdmin
from contests.views import _get_contests_data, get_active_contests_data
from db import get_connection


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_dashboard_contests(request):
    return Response(_get_contests_data())


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_dashboard_active_contests(request):
    return Response(get_active_contests_data())


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_users_list(request):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT 
                u.uuid AS external_id,
                u.username,
                u.email,
                CASE
                    WHEN r.role_name = 'participant' THEN 'user'
                    ELSE COALESCE(r.role_name, 'user')
                END AS role,
                u.status,
                u.created_at AS date_joined,
                p.full_name,
                p.college
            FROM user u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN profile p ON p.user_id = u.user_id
            WHERE u.deleted_at IS NULL
            ORDER BY u.created_at DESC
            """
        )

        users = cursor.fetchall()

        for user in users:
            if user.get("external_id"):
                user["external_id"] = str(user["external_id"])
            if user.get("date_joined"):
                user["date_joined"] = user["date_joined"].isoformat()

        return Response(users, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([IsAdmin])
def admin_problem_setters_list(request):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT 
                u.uuid AS external_id,
                u.username,
                u.email,
                u.status,
                u.created_at AS date_joined,
                p.full_name,
                p.college,
                COUNT(DISTINCT c.contest_id) AS contests_created
            FROM user u
            LEFT JOIN roles r ON u.role_id = r.role_id
            LEFT JOIN profile p ON p.user_id = u.user_id
            LEFT JOIN contests c ON c.created_by = u.user_id
            WHERE r.role_name = 'problem_setter' 
              AND u.deleted_at IS NULL
            GROUP BY
                u.user_id,
                u.uuid,
                u.username,
                u.email,
                u.status,
                u.created_at,
                p.full_name,
                p.college
            ORDER BY u.created_at DESC
            """
        )

        setters = cursor.fetchall()

        for setter in setters:
            if setter.get("external_id"):
                setter["external_id"] = str(setter["external_id"])
            if setter.get("date_joined"):
                setter["date_joined"] = setter["date_joined"].isoformat()

        return Response(setters, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["PATCH"])
@permission_classes([IsAdmin])
def admin_update_user_permissions(request, user_uuid):
    allowed_roles = {"user", "problem_setter", "admin"}
    allowed_statuses = {"active", "banned"}

    next_role = request.data.get("role")
    next_status = request.data.get("status")

    if next_role is None and next_status is None:
        return Response({"error": "Provide at least one field to update."}, status=400)

    if next_role is not None:
        next_role = str(next_role).strip().lower()
        if next_role not in allowed_roles:
            return Response({"error": "Invalid role."}, status=400)

    if next_status is not None:
        next_status = str(next_status).strip().lower()
        if next_status not in allowed_statuses:
            return Response({"error": "Invalid status. Use active or banned."}, status=400)

    conn = None
    cursor = None

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT
                u.user_id,
                u.uuid,
                u.username,
                u.email,
                u.status,
                u.created_at,
                r.role_name,
                p.full_name,
                p.bio,
                p.avatar_url,
                p.college,
                p.total_problems_solved
            FROM `user` u
            LEFT JOIN roles r ON r.role_id = u.role_id
            LEFT JOIN profile p ON p.user_id = u.user_id
            WHERE u.uuid = %s AND u.deleted_at IS NULL
            LIMIT 1
            """,
            (str(user_uuid),),
        )
        user_row = cursor.fetchone()

        if not user_row:
            return Response({"error": "User not found."}, status=404)

        request_user_id = getattr(request.user, "external_user_id", None)
        target_user_id = user_row.get("user_id")

        if next_role == "admin" and getattr(request.user, "role", None) != "admin":
            return Response({"error": "Only administrators can assign admin role."}, status=403)

        if target_user_id == request_user_id and next_role and next_role != "admin":
            return Response({"error": "You cannot remove your own admin access."}, status=400)

        if target_user_id == request_user_id and next_status and next_status != "active":
            return Response({"error": "You cannot change your own account status from this page."}, status=400)

        if next_role is not None:
            cursor.execute("SELECT role_id FROM roles WHERE role_name = %s LIMIT 1", (next_role,))
            role_row = cursor.fetchone()
            if not role_row:
                return Response({"error": "Role is unavailable."}, status=500)

            cursor.execute(
                "UPDATE `user` SET role_id = %s WHERE uuid = %s",
                (role_row["role_id"], str(user_uuid)),
            )

        if next_status is not None:
            cursor.execute(
                "UPDATE `user` SET status = %s WHERE uuid = %s",
                (next_status, str(user_uuid)),
            )

        conn.commit()

        cursor.execute(
            """
            SELECT
                u.user_id,
                u.uuid,
                u.username,
                u.email,
                u.status,
                u.created_at,
                r.role_name,
                p.full_name,
                p.bio,
                p.avatar_url,
                p.college,
                p.total_problems_solved
            FROM `user` u
            LEFT JOIN roles r ON r.role_id = u.role_id
            LEFT JOIN profile p ON p.user_id = u.user_id
            WHERE u.uuid = %s AND u.deleted_at IS NULL
            LIMIT 1
            """,
            (str(user_uuid),),
        )
        updated_user = cursor.fetchone()
        sync_django_user_from_external_row(updated_user)
        updated_role = updated_user.get("role_name") or "user"
        if updated_role == "participant":
            updated_role = "user"

        return Response(
            {
                "message": "Permissions updated successfully.",
                "user": {
                    "external_id": str(updated_user["uuid"]),
                    "username": updated_user["username"],
                    "email": updated_user["email"],
                    "role": updated_role,
                    "status": updated_user["status"],
                    "full_name": updated_user.get("full_name"),
                    "college": updated_user.get("college"),
                    "date_joined": updated_user["created_at"].isoformat() if updated_user.get("created_at") else None,
                },
            },
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
