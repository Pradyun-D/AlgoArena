from django.shortcuts import render
from django.conf import settings
from django.contrib.auth import login as django_login, logout as django_logout
from django.contrib.auth import get_user_model
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from .auth_sync import build_auth_response, clear_auth_cookies, get_current_external_user, sync_django_user_from_external_row
from .permissions import IsAuthenticated
from db import get_connection
import uuid
import time


def auth_page(request):
	return render(request, 'accounts/auth.html')


@login_required
def profile_page(request):
	return render(request, 'accounts/profile.html', {'user': request.user})


def _ensure_default_roles(cursor):
	cursor.executemany(
		"""
		INSERT IGNORE INTO roles (role_name, description)
		VALUES (%s, %s)
		""",
		[
			("user", "Default platform user"),
			("problem_setter", "Problem setter account"),
			("admin", "Administrator account"),
		],
	)


def _serialize_user_row(row):
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


def _build_registered_rounds(cursor, user_id):
	cursor.execute(
		"""
		SELECT
			c.contest_id,
			c.title,
			c.start_time,
			c.end_time,
			CASE
				WHEN c.start_time > UTC_TIMESTAMP() THEN 'Upcoming'
				WHEN c.end_time <= UTC_TIMESTAMP() THEN 'Completed'
				ELSE 'Active'
			END AS contest_status
		FROM contest_participants cp
		JOIN contests c ON c.contest_id = cp.contest_id
		WHERE cp.user_id = %s
		ORDER BY c.start_time DESC, c.created_at DESC
		LIMIT 4
		""",
		(user_id,),
	)

	rounds = []
	for row in cursor.fetchall():
		status = str(row.get("contest_status") or "").strip()
		if status == "Active":
			subtitle = "Active Now"
		elif status == "Upcoming" and row.get("start_time"):
			subtitle = f"Starts at {row['start_time'].strftime('%d %b, %I:%M %p')}"
		elif row.get("start_time"):
			subtitle = f"Registered for {row['start_time'].strftime('%d %b, %I:%M %p')}"
		else:
			subtitle = "Registered"

		rounds.append({
			"title": row.get("title") or "Untitled Contest",
			"subtitle": subtitle,
			"is_live": status == "Active",
		})

	return rounds


def _get_user_by_identifier(cursor, identifier):
	cursor.execute(
		"""
		SELECT
			u.user_id,
			u.uuid,
			u.username,
			u.email,
			u.password_hash,
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
		FROM `user` u
		LEFT JOIN roles r ON r.role_id = u.role_id
		LEFT JOIN profile p ON p.user_id = u.user_id
		WHERE (u.email = %s OR u.username = %s) AND u.deleted_at IS NULL
		LIMIT 1
		""",
		(identifier, identifier),
	)
	return cursor.fetchone()


def _get_user_by_uuid(cursor, user_uuid):
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
			p.total_problems_solved,
			(
				SELECT COUNT(*)
				FROM `Submissions` s
				WHERE s.user_id = u.user_id
			) AS submissions_count
		FROM `user` u
		LEFT JOIN roles r ON r.role_id = u.role_id
		LEFT JOIN profile p ON p.user_id = u.user_id
		WHERE u.uuid = %s AND u.deleted_at IS NULL
		LIMIT 1
		""",
		(user_uuid,),
	)
	return cursor.fetchone()


@api_view(["GET"])
@permission_classes([AllowAny])
def platform_metrics(request):
	start = time.perf_counter()
	conn = None
	cursor = None

	try:
		conn = get_connection()
		cursor = conn.cursor(dictionary=True)

		cursor.execute("SELECT COUNT(*) AS total_users FROM `user` WHERE deleted_at IS NULL")
		total_users = cursor.fetchone().get("total_users") or 0

		cursor.execute("SELECT COUNT(*) AS total_submissions FROM `Submissions`")
		total_submissions = cursor.fetchone().get("total_submissions") or 0

		cursor.execute(
			"""
			SELECT
				COUNT(*) AS total_contests,
				SUM(CASE WHEN start_time <= UTC_TIMESTAMP() AND end_time > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS active_contests,
				SUM(CASE WHEN end_time <= UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS completed_contests,
				SUM(CASE WHEN start_time > UTC_TIMESTAMP() THEN 1 ELSE 0 END) AS upcoming_contests
			FROM contests
			WHERE visibility <> 'private'
			"""
		)
		contest_counts = cursor.fetchone() or {}

		cursor.execute("SELECT 1")
		cursor.fetchone()
		latency_ms = max(1, int((time.perf_counter() - start) * 1000))

		return Response(
			{
				"total_users": total_users,
				"total_submissions": total_submissions,
				"total_contests": contest_counts.get("total_contests") or 0,
				"active_contests": contest_counts.get("active_contests") or 0,
				"completed_contests": contest_counts.get("completed_contests") or 0,
				"upcoming_contests": contest_counts.get("upcoming_contests") or 0,
				"server_latency_ms": latency_ms,
			},
			status=200,
		)
	except Exception as e:
		return Response({"error": str(e)}, status=500)
	finally:
		if cursor is not None:
			cursor.close()
		if conn is not None and conn.is_connected():
			conn.close()


@api_view(["POST"])
@permission_classes([AllowAny])
def register_account(request):
	username = str(request.data.get("username", "")).strip()
	email = str(request.data.get("email", "")).strip().lower()
	password = str(request.data.get("password", ""))
	confirm_password = str(request.data.get("confirm_password", ""))
	full_name = str(request.data.get("full_name", "")).strip()

	if not username or not email or not password:
		return Response({"error": "Username, email, and password are required."}, status=400)

	if confirm_password and password != confirm_password:
		return Response({"error": "Passwords do not match."}, status=400)

	if len(password) < 8:
		return Response({"error": "Password must be at least 8 characters long."}, status=400)

	conn = get_connection()
	cursor = conn.cursor(dictionary=True)
	try:
		_ensure_default_roles(cursor)

		cursor.execute("SELECT 1 FROM `user` WHERE username = %s AND deleted_at IS NULL LIMIT 1", (username,))
		if cursor.fetchone():
			return Response({"error": "Username is already taken."}, status=400)

		cursor.execute("SELECT 1 FROM `user` WHERE email = %s AND deleted_at IS NULL LIMIT 1", (email,))
		if cursor.fetchone():
			return Response({"error": "Email is already registered."}, status=400)

		cursor.execute("SELECT role_id FROM roles WHERE role_name = %s LIMIT 1", ("user",))
		role = cursor.fetchone()
		if not role:
			return Response({"error": "Default role is unavailable."}, status=500)

		user_uuid = str(uuid.uuid4())
		profile_uuid = str(uuid.uuid4())
		password_hash = make_password(password)

		cursor.execute(
			"""
			INSERT INTO `user` (uuid, username, email, password_hash, role_id, status)
			VALUES (%s, %s, %s, %s, %s, 'active')
			""",
			(user_uuid, username, email, password_hash, role["role_id"]),
		)
		user_id = cursor.lastrowid

		cursor.execute(
			"""
			INSERT INTO profile (uuid, user_id, full_name, bio, avatar_url, college, total_problems_solved)
			VALUES (%s, %s, %s, %s, %s, %s, %s)
			""",
			(profile_uuid, user_id, full_name or username, "", "", "", 0),
		)
		conn.commit()

		user = _get_user_by_uuid(cursor, user_uuid)
		if user:
			user["password_hash"] = password_hash
			sync_django_user_from_external_row(user)
		return Response({"message": "Account created successfully.", "user": _serialize_user_row(user)}, status=201)
	except Exception as e:
		conn.rollback()
		return Response({"error": str(e)}, status=500)
	finally:
		cursor.close()
		conn.close()


@api_view(["POST"])
@permission_classes([AllowAny])
def login_account(request):
	identifier = str(request.data.get("identifier", "")).strip()
	password = str(request.data.get("password", ""))

	if not identifier or not password:
		return Response({"error": "Username/email and password are required."}, status=400)

	conn = get_connection()
	cursor = conn.cursor(dictionary=True)
	try:
		user = _get_user_by_identifier(cursor, identifier)
		if not user:
			return Response({"error": "Invalid credentials."}, status=401)

		if user["status"] != "active":
			return Response({"error": "Account is banned."}, status=403)

		if not check_password(password, user["password_hash"]):
			return Response({"error": "Invalid credentials."}, status=401)

		django_user = sync_django_user_from_external_row(user)
		django_login(request, django_user, backend="django.contrib.auth.backends.ModelBackend")
		return build_auth_response(
			django_user,
			{"message": "Login successful.", "user": _serialize_user_row(user)},
			status_code=200,
		)
	finally:
		cursor.close()
		conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def session_account(request):
	if not getattr(request.user, "is_authenticated", False):
		return Response({"user": None}, status=200)

	conn = get_connection()
	cursor = conn.cursor(dictionary=True)
	try:
		user = get_current_external_user(request, cursor=cursor)
		if not user:
			return Response({"error": "Authenticated user is not linked to a platform account."}, status=404)
		if user.get("status") != "active":
			django_logout(request)
			response = Response({"error": "Account is banned."}, status=403)
			return clear_auth_cookies(response)
		user_payload = _serialize_user_row(user)
		user_payload["registered_rounds"] = _build_registered_rounds(cursor, user["user_id"])
		return Response({"user": user_payload}, status=200)
	finally:
		cursor.close()
		conn.close()


@api_view(["POST"])
@permission_classes([AllowAny])
def refresh_session(request):
	auth_settings = settings.REST_AUTH
	refresh_cookie_name = auth_settings.get("JWT_AUTH_REFRESH_COOKIE")
	refresh_token = request.COOKIES.get(refresh_cookie_name)

	if not refresh_token:
		response = Response({"error": "Refresh token is missing."}, status=401)
		return clear_auth_cookies(response)

	try:
		refresh = RefreshToken(refresh_token)
		user_id = refresh.get("user_id")
		if not user_id:
			raise TokenError("Token missing user id.")

		User = get_user_model()
		user = User.objects.filter(id=user_id).first()
		if not user or not user.is_active or getattr(user, "account_status", "active") != "active":
			response = Response({"error": "User is no longer active."}, status=401)
			return clear_auth_cookies(response)

		response = Response({"message": "Session refreshed."}, status=200)
		response.set_cookie(
			auth_settings["JWT_AUTH_COOKIE"],
			str(refresh.access_token),
			httponly=auth_settings.get("JWT_AUTH_HTTPONLY", True),
			secure=auth_settings.get("JWT_AUTH_SECURE", False),
			samesite=auth_settings.get("JWT_AUTH_SAMESITE", "Lax"),
			max_age=int(refresh.access_token.lifetime.total_seconds()),
			path="/",
		)
		return response
	except TokenError:
		response = Response({"error": "Refresh token is invalid or expired."}, status=401)
		return clear_auth_cookies(response)


@api_view(["POST"])
@permission_classes([AllowAny])
def logout_account(request):
	django_logout(request)
	response = Response({"message": "Logout successful."}, status=200)
	return clear_auth_cookies(response)


@api_view(["GET", "PUT"])
@permission_classes([AllowAny])
def profile_detail(request, user_uuid):
	conn = get_connection()
	cursor = conn.cursor(dictionary=True)
	try:
		if request.method == "GET":
			user = _get_user_by_uuid(cursor, user_uuid)
			if not user:
				return Response({"error": "User not found."}, status=404)
			return Response({"user": _serialize_user_row(user)}, status=200)

		username = str(request.data.get("username", "")).strip()
		full_name = str(request.data.get("full_name", "")).strip()
		bio = str(request.data.get("bio", "")).strip()
		avatar_url = str(request.data.get("avatar_url", "")).strip()
		college = str(request.data.get("college", "")).strip()

		user = _get_user_by_uuid(cursor, user_uuid)
		if not user:
			return Response({"error": "User not found."}, status=404)

		if username and username != user["username"]:
			cursor.execute(
				"""
				SELECT 1 FROM `user`
				WHERE username = %s AND uuid <> %s AND deleted_at IS NULL
				LIMIT 1
				""",
				(username, user_uuid),
			)
			if cursor.fetchone():
				return Response({"error": "Username is already taken."}, status=400)

			cursor.execute("UPDATE `user` SET username = %s WHERE uuid = %s", (username, user_uuid))

		cursor.execute(
			"""
			UPDATE profile
			SET full_name = %s, bio = %s, avatar_url = %s, college = %s
			WHERE user_id = %s
			""",
			(
				full_name or user.get("full_name") or user["username"],
				bio,
				avatar_url,
				college,
				user["user_id"],
			),
		)
		conn.commit()

		updated_user = _get_user_by_uuid(cursor, user_uuid)
		return Response({"message": "Profile updated successfully.", "user": _serialize_user_row(updated_user)}, status=200)
	except Exception as e:
		conn.rollback()
		return Response({"error": str(e)}, status=500)
	finally:
		cursor.close()
		conn.close()
