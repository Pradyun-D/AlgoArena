from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from db import get_connection
from .contest_serializer import ContestSerializer
from ._helpers import (
    _get_request_user_external_id,
    _can_view_private_contests,
    _is_privileged_contest_user,
    _contest_is_live,
    _fetch_contest_with_registration,
    _attach_creator_username,
    _get_contests_data,
    _get_past_contests_data,
    get_active_contests_data,
)


@api_view(["GET"])
@permission_classes([AllowAny])
def all_contests(request):
    return Response(
        _get_contests_data(
            user_id=_get_request_user_external_id(request),
            include_private=_can_view_private_contests(request),
        )
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def past_contests(request):
    return Response(_get_past_contests_data(_get_request_user_external_id(request)))


@api_view(["GET"])
@permission_classes([AllowAny])
def active_contests(request):
    try:
        return Response(get_active_contests_data())
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_info(request, contest_id):
    contest_id = str(contest_id)
    user_id = _get_request_user_external_id(request)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        result_contest = _fetch_contest_with_registration(cursor, contest_id, user_id)
        if not result_contest:
            return Response({"message": "Contest with this id doesn't exist", "status": 404})

        result_contest = _attach_creator_username(cursor, result_contest)

        if (
            _contest_is_live(result_contest)
            and not result_contest.get("is_registered")
            and not _is_privileged_contest_user(request)
        ):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        if user_id:
            cursor.execute(
                """
                SELECT p.problem_id, p.title, p.description, p.difficulty, p.time_limit_ms,
                       p.memory_limit_kb, p.visibility, cp.max_score,
                       COALESCE(cps.score, 0) AS user_score
                FROM contest_problems cp
                JOIN problems p ON p.problem_id = cp.problem_id
                LEFT JOIN contest_problem_scores cps
                    ON cps.contest_id = cp.contest_id
                   AND cps.problem_id = cp.problem_id
                   AND cps.user_id = %s
                WHERE cp.contest_id = %s
                ORDER BY p.created_at ASC
                """,
                (user_id, contest_id),
            )
        else:
            cursor.execute(
                """
                SELECT p.problem_id, p.title, p.description, p.difficulty, p.time_limit_ms,
                       p.memory_limit_kb, p.visibility, cp.max_score,
                       0 AS user_score
                FROM contest_problems cp
                JOIN problems p ON p.problem_id = cp.problem_id
                WHERE cp.contest_id = %s
                ORDER BY p.created_at ASC
                """,
                (contest_id,),
            )
        result_problem = cursor.fetchall()

        problem_ids = [str(p["problem_id"]) for p in result_problem]
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
                tags_by_problem.setdefault(row["problem_id"], []).append(row["name"])

        serialized_payload = {
            "contest": result_contest,
            "problems": [
                {
                    **problem,
                    "problem_id": str(problem["problem_id"]),
                    "tags": tags_by_problem.get(str(problem["problem_id"]), []),
                }
                for problem in result_problem
            ],
        }

        serializer = ContestSerializer(instance=serialized_payload)
        return Response({"data": serializer.data, "status": 200})
    except Exception as e:
        return Response({"error": str(e), "status": 500})
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_registration_status(request, contest_id):
    contest_id = str(contest_id)
    user_id = _get_request_user_external_id(request)

    try:
        if user_id is None:
            return Response({"is_registered": False}, status=200)

        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT EXISTS(
                SELECT 1
                FROM contest_participants
                WHERE contest_id = %s AND user_id = %s
            ) AS is_registered
            """,
            (contest_id, str(user_id)),
        )
        row = cursor.fetchone() or {}
        return Response({"is_registered": bool(row.get("is_registered"))}, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_leaderboard(request, contest_id):
    contest_id = str(contest_id)
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT title FROM contests WHERE contest_id = %s", (contest_id,))
        if not cursor.fetchone():
            return Response({"error": "Contest not found", "status": 404}, status=404)

        cursor.execute(
            """
            SELECT p.problem_id, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s
            ORDER BY p.created_at ASC
            """,
            (contest_id,),
        )
        problem_rows = cursor.fetchall()

        letter_map = {}
        for index, p in enumerate(problem_rows):
            letter_map[str(p["problem_id"])] = {
                "letter": chr(65 + index),
                "max_score": p["max_score"],
            }
        problems_list = [{"problem_id": pid, **meta} for pid, meta in letter_map.items()]

        cursor.execute(
            """
            SELECT cps.user_id, cps.problem_id, cps.score, cps.time_penalty_ms, cps.is_accepted,
                   u.username
            FROM contest_problem_scores cps
            JOIN user u ON u.user_id = cps.user_id
            WHERE cps.contest_id = %s
            """,
            (contest_id,),
        )

        users_map = {}
        for row in cursor.fetchall():
            uid = row["user_id"]
            if uid not in users_map:
                users_map[uid] = {
                    "user_id": uid,
                    "username": row["username"],
                    "total_score": 0,
                    "total_penalty": 0,
                    "scores": {},
                }
            pid = str(row["problem_id"])
            users_map[uid]["scores"][pid] = {
                "score": row["score"],
                "time_penalty_ms": row["time_penalty_ms"] or 0,
                "is_accepted": bool(row["is_accepted"]),
            }
            users_map[uid]["total_score"] += row["score"]
            users_map[uid]["total_penalty"] += row["time_penalty_ms"] or 0

        leaderboard = sorted(
            users_map.values(),
            key=lambda x: (-x["total_score"], x["total_penalty"]),
        )
        for i, u in enumerate(leaderboard):
            u["rank"] = i + 1

        return Response({"status": 200, "data": {"problems": problems_list, "leaderboard": leaderboard}})
    except Exception as e:
        return Response({"error": str(e), "status": 500}, status=500)
    finally:
        cursor.close()
        conn.close()


@api_view(["POST"])
@permission_classes([AllowAny])
def register_participant(request, contest_id):
    from accounts.permissions import IsAuthenticated
    from rest_framework.decorators import permission_classes as pc

    contest_id = str(contest_id)
    user_id = _get_request_user_external_id(request)
    if user_id is None:
        return Response(
            {"error": "Authenticated user is not linked to a platform account.", "status": 403},
            status=403,
        )

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT contest_id, start_time FROM contests WHERE contest_id = %s LIMIT 1",
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found.", "status": 404}, status=404)

        if _contest_is_live(contest) and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            "INSERT INTO contest_participants (contest_id, user_id) VALUES (%s, %s)",
            (contest_id, str(user_id)),
        )
        conn.commit()
        return Response({"message": "Registered successfully", "status": 201}, status=201)

    except Exception as e:
        if "Duplicate entry" in str(e):
            return Response({"message": "You are already registered for this contest."}, status=409)
        return Response({"error": str(e), "status": 500}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()