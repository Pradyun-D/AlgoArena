import uuid

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from accounts.permissions import IsProblemSetter
from db import get_connection
from .contest_serializer import ProblemManageSerializer
from ._helpers import (
    _get_request_user_external_id,
    _is_privileged_contest_user,
    _contest_is_live,
    _fetch_contest_with_registration,
)


@api_view(["GET"])
@permission_classes([IsProblemSetter])
def get_contest_problem_editor_data(request, contest_id):
    contest_id = str(contest_id)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests WHERE contest_id = %s
            """,
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        cursor.execute(
            """
            SELECT p.problem_id, p.title, p.slug, p.description, p.difficulty,
                   p.time_limit_ms, p.memory_limit_kb, p.visibility, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s
            ORDER BY p.created_at ASC
            """,
            (contest_id,),
        )
        problems = cursor.fetchall()

        problem_ids = [str(p["problem_id"]) for p in problems]
        tags_by_problem = {pid: [] for pid in problem_ids}
        testcases_by_problem = {pid: [] for pid in problem_ids}

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
                tags_by_problem.setdefault(str(row["problem_id"]), []).append(row["name"])

            cursor.execute(
                f"""
                SELECT testcase_id, problem_id, input AS input_data,
                       expected_output AS output_data, NOT is_sample AS is_hidden
                FROM testcases
                WHERE problem_id IN ({placeholders})
                ORDER BY created_at ASC
                """,
                tuple(problem_ids),
            )
            for row in cursor.fetchall():
                row["problem_id"] = str(row["problem_id"])
                row["testcase_id"] = str(row["testcase_id"])
                testcases_by_problem.setdefault(row["problem_id"], []).append(
                    {
                        "testcase_id": row["testcase_id"],
                        "input_data": row.get("input_data", ""),
                        "output_data": row.get("output_data", ""),
                        "is_hidden": bool(row.get("is_hidden", True)),
                    }
                )

        payload = {
            "contest": contest,
            "problems": [
                {
                    **problem,
                    "problem_id": str(problem["problem_id"]),
                    "tags": tags_by_problem.get(str(problem["problem_id"]), []),
                    "testcases": testcases_by_problem.get(str(problem["problem_id"]), []),
                }
                for problem in problems
            ],
        }
        return Response({"data": payload, "status": 200})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_problem_solving_data(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)
    user_id = _get_request_user_external_id(request)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        contest = _fetch_contest_with_registration(cursor, contest_id, user_id)
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        if (
            _contest_is_live(contest)
            and not contest.get("is_registered")
            and not _is_privileged_contest_user(request)
        ):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            """
            SELECT p.problem_id, p.title, p.slug, p.description, p.difficulty,
                   p.time_limit_ms, p.memory_limit_kb, p.visibility, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s AND cp.problem_id = %s
            LIMIT 1
            """,
            (contest_id, problem_id),
        )
        problem = cursor.fetchone()
        if not problem:
            return Response({"error": "Problem not found in this contest."}, status=404)

        cursor.execute(
            """
            SELECT t.name
            FROM problem_tags pt
            JOIN tags t ON t.tag_id = pt.tag_id
            WHERE pt.problem_id = %s
            ORDER BY t.name ASC
            """,
            (problem_id,),
        )
        tags = [row["name"] for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT testcase_id, input AS input_data, expected_output AS output_data
            FROM testcases
            WHERE problem_id = %s AND is_sample = TRUE
            ORDER BY created_at ASC
            """,
            (problem_id,),
        )
        visible_testcases = [
            {
                "testcase_id": str(row["testcase_id"]),
                "input_data": row.get("input_data", ""),
                "output_data": row.get("output_data", ""),
            }
            for row in cursor.fetchall()
        ]

        cursor.execute(
            "SELECT COUNT(*) AS hidden_count FROM testcases WHERE problem_id = %s AND is_sample = FALSE",
            (problem_id,),
        )
        hidden_testcases = cursor.fetchone() or {"hidden_count": 0}

        cursor.execute("SELECT language_id, name FROM languages ORDER BY name ASC")
        languages = [{"language_id": row["language_id"], "name": row["name"]} for row in cursor.fetchall()]

        cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   l.name AS language_name, s.source_code, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            WHERE s.contest_id = %s AND s.problem_id = %s
            ORDER BY s.submitted_at DESC
            LIMIT 25
            """,
            (contest_id, problem_id),
        )
        from ._helpers import _serialize_submission_row
        submissions = [_serialize_submission_row(row) for row in cursor.fetchall()]

        payload = {
            "contest": contest,
            "problem": {**problem, "problem_id": str(problem["problem_id"]), "tags": tags},
            "visible_testcases": visible_testcases,
            "hidden_testcase_count": hidden_testcases["hidden_count"],
            "languages": languages,
            "submissions": submissions,
        }
        return Response({"data": payload, "status": 200})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsProblemSetter])
def create_contest_problem(request, contest_id):
    contest_id = str(contest_id)

    serializer = ProblemManageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    validated = serializer.validated_data

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT contest_id, created_by FROM contests WHERE contest_id = %s LIMIT 1",
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        problem_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO problems
            (problem_id, title, slug, description, difficulty, time_limit_ms,
             memory_limit_kb, visibility, created_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                problem_id,
                validated["title"],
                validated["slug"],
                validated.get("description", ""),
                validated["difficulty"],
                validated["time_limit_ms"],
                validated["memory_limit_kb"],
                validated["visibility"],
                contest.get("created_by"),
            ),
        )
        cursor.execute(
            "INSERT INTO contest_problems (contest_id, problem_id, max_score) VALUES (%s, %s, %s)",
            (contest_id, problem_id, validated["max_score"]),
        )

        cursor.execute("DELETE FROM problem_tags WHERE problem_id = %s", (problem_id,))
        for tag_name in validated.get("tags", []):
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s LIMIT 1", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    "INSERT IGNORE INTO problem_tags (problem_id, tag_id) VALUES (%s, %s)",
                    (problem_id, tag_row["tag_id"]),
                )

        for testcase in validated.get("testcases", []):
            cursor.execute(
                """
                INSERT INTO testcases (testcase_id, problem_id, input, expected_output, is_sample)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    str(testcase.get("testcase_id") or uuid.uuid4()),
                    problem_id,
                    testcase.get("input_data", ""),
                    testcase.get("output_data", ""),
                    not testcase.get("is_hidden", True),
                ),
            )

        conn.commit()

        response_problem = {
            "problem_id": problem_id,
            "title": validated["title"],
            "slug": validated["slug"],
            "description": validated.get("description", ""),
            "difficulty": validated["difficulty"],
            "time_limit_ms": validated["time_limit_ms"],
            "memory_limit_kb": validated["memory_limit_kb"],
            "visibility": validated["visibility"],
            "max_score": validated["max_score"],
            "tags": validated.get("tags", []),
            "testcases": validated.get("testcases", []),
        }
        return Response({"message": "Problem created successfully.", "problem": response_problem}, status=201)
    except Exception as e:
        if "conn" in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["PUT"])
@permission_classes([IsProblemSetter])
def update_contest_problem(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)

    serializer = ProblemManageSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    validated = serializer.validated_data

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT contest_id, start_time FROM contests WHERE contest_id = %s LIMIT 1",
            (contest_id,),
        )
        if not cursor.fetchone():
            return Response({"error": "Contest not found."}, status=404)

        cursor.execute(
            "SELECT 1 FROM contest_problems WHERE contest_id = %s AND problem_id = %s LIMIT 1",
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        cursor.execute(
            """
            UPDATE problems
            SET title = %s,
                slug = %s,
                description = %s,
                difficulty = %s,
                time_limit_ms = %s,
                memory_limit_kb = %s,
                visibility = %s,
                updated_at = UTC_TIMESTAMP()
            WHERE problem_id = %s
            """,
            (
                validated["title"],
                validated["slug"],
                validated.get("description", ""),
                validated["difficulty"],
                validated["time_limit_ms"],
                validated["memory_limit_kb"],
                validated["visibility"],
                problem_id,
            ),
        )
        cursor.execute(
            "UPDATE contest_problems SET max_score = %s WHERE contest_id = %s AND problem_id = %s",
            (validated["max_score"], contest_id, problem_id),
        )

        cursor.execute("DELETE FROM problem_tags WHERE problem_id = %s", (problem_id,))
        for tag_name in validated.get("tags", []):
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s LIMIT 1", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    "INSERT IGNORE INTO problem_tags (problem_id, tag_id) VALUES (%s, %s)",
                    (problem_id, tag_row["tag_id"]),
                )

        cursor.execute("DELETE FROM testcases WHERE problem_id = %s", (problem_id,))
        for testcase in validated.get("testcases", []):
            cursor.execute(
                """
                INSERT INTO testcases (testcase_id, problem_id, input, expected_output, is_sample)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (
                    str(testcase.get("testcase_id") or uuid.uuid4()),
                    problem_id,
                    testcase.get("input_data", ""),
                    testcase.get("output_data", ""),
                    not testcase.get("is_hidden", True),
                ),
            )

        conn.commit()
        return Response({"message": "Problem updated successfully.", "status": 200}, status=200)
    except Exception as e:
        if "conn" in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()