from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from db import get_connection


ROLE_ROWS = [
    ("user", "Default platform user"),
    ("problem_setter", "Problem setter account"),
    ("admin", "Administrator account"),
]
ROLE_GROUP_NAMES = {role_name for role_name, _ in ROLE_ROWS}


def ensure_default_roles(cursor):
    cursor.executemany(
        """
        INSERT IGNORE INTO roles (role_name, description)
        VALUES (%s, %s)
        """,
        ROLE_ROWS,
    )


def serialize_user_row(row):
    if not row:
        return None

    role_name = row.get("role_name") or "user"
    if role_name == "participant":
        role_name = "user"

    return {
        "user_id": row["user_id"],
        "uuid": row["uuid"],
        "username": row["username"],
        "email": row["email"],
        "status": row["status"],
        "created_at": row.get("created_at"),
        "role": role_name,
        "profile": {
            "full_name": row.get("full_name") or "",
            "bio": row.get("bio") or "",
            "avatar_url": row.get("avatar_url") or "",
            "college": row.get("college") or "",
            "total_problems_solved": row.get("total_problems_solved") or 0,
        },
        "submissions_count": row.get("submissions_count") or 0,
    }


def _base_user_select(include_password=False):
    password_sql = ", u.password_hash" if include_password else ""

    return f"""
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
            p.total_problems_solved,
            (
                SELECT COUNT(*)
                FROM `Submissions` s
                WHERE s.user_id = u.user_id
            ) AS submissions_count
            {password_sql}
        FROM `user` u
        LEFT JOIN roles r ON r.role_id = u.role_id
        LEFT JOIN profile p ON p.user_id = u.user_id
    """


def get_user_by_identifier(cursor, identifier, include_password=False):
    cursor.execute(
        _base_user_select(include_password=include_password)
        + """
        WHERE (u.email = %s OR u.username = %s) AND u.deleted_at IS NULL
        LIMIT 1
        """,
        (identifier, identifier),
    )
    return cursor.fetchone()


def get_user_by_uuid(cursor, user_uuid, include_password=False):
    cursor.execute(
        _base_user_select(include_password=include_password)
        + """
        WHERE u.uuid = %s AND u.deleted_at IS NULL
        LIMIT 1
        """,
        (user_uuid,),
    )
    return cursor.fetchone()


def get_user_by_external_id(cursor, external_user_id, include_password=False):
    cursor.execute(
        _base_user_select(include_password=include_password)
        + """
        WHERE u.user_id = %s AND u.deleted_at IS NULL
        LIMIT 1
        """,
        (external_user_id,),
    )
    return cursor.fetchone()


def get_current_external_user(request, cursor=None, include_password=False):
    if not getattr(request.user, "is_authenticated", False):
        return None

    external_user_id = getattr(request.user, "external_user_id", None)
    external_uuid = getattr(request.user, "external_uuid", None)
    email = getattr(request.user, "email", None)

    owns_connection = cursor is None
    conn = None

    try:
        if cursor is None:
            conn = get_connection()
            cursor = conn.cursor(dictionary=True)

        row = None
        if external_user_id:
            row = get_user_by_external_id(cursor, external_user_id, include_password=include_password)
        if not row and external_uuid:
            row = get_user_by_uuid(cursor, external_uuid, include_password=include_password)
        if not row and email:
            row = get_user_by_identifier(cursor, email, include_password=include_password)

        if row:
            sync_django_user_from_external_row(row)

        return row
    finally:
        if owns_connection and cursor is not None:
            cursor.close()
        if owns_connection and conn is not None and conn.is_connected():
            conn.close()


def sync_django_user_from_external_row(row):
    if not row:
        return None

    User = get_user_model()
    django_user = None

    external_user_id = row.get("user_id")
    external_uuid = row.get("uuid")
    email = row.get("email")

    if external_user_id is not None:
        django_user = User.objects.filter(external_user_id=external_user_id).first()
    if django_user is None and external_uuid:
        django_user = User.objects.filter(external_uuid=external_uuid).first()
    if django_user is None and email:
        django_user = User.objects.filter(email=email).first()

    if django_user is None:
        django_user = User(email=email)

    django_user.username = row.get("username") or django_user.username or email
    django_user.email = email
    role_name = row.get("role_name") or "user"
    django_user.role = "user" if role_name == "participant" else role_name
    django_user.external_user_id = external_user_id
    django_user.external_uuid = external_uuid
    django_user.account_status = row.get("status") or "active"
    django_user.is_active = django_user.account_status == "active"
    django_user.is_staff = django_user.role == "admin"
    django_user.is_superuser = django_user.role == "admin"

    password_hash = row.get("password_hash")
    if password_hash and django_user.password != password_hash:
        django_user.password = password_hash

    django_user.save()
    _sync_django_role_group(django_user)
    return django_user


def _sync_django_role_group(django_user):
    role_name = django_user.role if django_user.role in ROLE_GROUP_NAMES else "user"
    role_group, _ = Group.objects.get_or_create(name=role_name)

    current_group_ids = list(
        Group.objects.filter(name__in=ROLE_GROUP_NAMES).values_list("id", flat=True)
    )
    if current_group_ids:
        django_user.groups.remove(*current_group_ids)
    django_user.groups.add(role_group)


def build_auth_response(user, payload, status_code=200):
    refresh = RefreshToken.for_user(user)
    access = refresh.access_token
    auth_settings = settings.REST_AUTH
    secure = auth_settings.get("JWT_AUTH_SECURE", False)
    samesite = auth_settings.get("JWT_AUTH_SAMESITE", "Lax")

    response = Response(payload, status=status_code)
    response.set_cookie(
        auth_settings["JWT_AUTH_COOKIE"],
        str(access),
        httponly=auth_settings.get("JWT_AUTH_HTTPONLY", True),
        secure=secure,
        samesite=samesite,
        max_age=int(access.lifetime.total_seconds()),
        path="/",
    )
    response.set_cookie(
        auth_settings["JWT_AUTH_REFRESH_COOKIE"],
        str(refresh),
        httponly=auth_settings.get("JWT_AUTH_HTTPONLY", True),
        secure=secure,
        samesite=samesite,
        max_age=int(refresh.lifetime.total_seconds()),
        path="/",
    )
    return response


def clear_auth_cookies(response):
    auth_settings = settings.REST_AUTH
    response.delete_cookie(auth_settings["JWT_AUTH_COOKIE"], path="/")
    response.delete_cookie(auth_settings["JWT_AUTH_REFRESH_COOKIE"], path="/")
    return response
