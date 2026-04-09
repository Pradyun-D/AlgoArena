from django.shortcuts import render
from django.contrib.auth.decorators import login_required
from django.contrib.auth.hashers import check_password, make_password
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from db import get_connection
import uuid


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

	return {
		"user_id": row["user_id"],
		"uuid": row["uuid"],
		"username": row["username"],
		"email": row["email"],
		"status": row["status"],
		"created_at": row.get("created_at"),
		"role": row.get("role_name") or "user",
		"profile": {
			"full_name": row.get("full_name") or "",
			"bio": row.get("bio") or "",
			"avatar_url": row.get("avatar_url") or "",
			"college": row.get("college") or "",
			"total_problems_solved": row.get("total_problems_solved") or 0,
		},
	}


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
			p.total_problems_solved
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
			p.total_problems_solved
		FROM `user` u
		LEFT JOIN roles r ON r.role_id = u.role_id
		LEFT JOIN profile p ON p.user_id = u.user_id
		WHERE u.uuid = %s AND u.deleted_at IS NULL
		LIMIT 1
		""",
		(user_uuid,),
	)
	return cursor.fetchone()


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
			return Response({"error": f"Account is {user['status']}."}, status=403)

		if not check_password(password, user["password_hash"]):
			return Response({"error": "Invalid credentials."}, status=401)

		return Response({"message": "Login successful.", "user": _serialize_user_row(user)}, status=200)
	finally:
		cursor.close()
		conn.close()


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
