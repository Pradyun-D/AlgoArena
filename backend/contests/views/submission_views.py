import uuid

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from accounts.permissions import IsAuthenticated
from db import get_connection
from ..judge.submit import judge_submission
from ._helpers import (
    _get_request_user_external_id,
    _is_privileged_contest_user,
    _contest_is_live,
    _serialize_submission_row,
)


def _resolve_language_id(cursor, requested_language_id, requested_language_name):
    cursor.execute("SELECT language_id, name FROM languages ORDER BY name ASC")
    languages = [{"language_id": row["language_id"], "name": row["name"]} for row in cursor.fetchall()]

    selected_language_id = None
    if requested_language_id is not None:
        cursor.execute(
            "SELECT language_id FROM languages WHERE language_id = %s LIMIT 1",
            (requested_language_id,),
        )
        row = cursor.fetchone()
        if row:
            selected_language_id = row["language_id"]

    if selected_language_id is None and requested_language_name:
        cursor.execute("INSERT IGNORE INTO languages (name) VALUES (%s)", (requested_language_name,))
        cursor.execute("SELECT language_id FROM languages WHERE name = %s LIMIT 1", (requested_language_name,))
        row = cursor.fetchone()
        if row:
            selected_language_id = row["language_id"]

    if selected_language_id is None and languages:
        selected_language_id = languages[0]["language_id"]

    return selected_language_id, languages


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def submit_solution(request, contest_id, problem_id):
    source_code = request.data.get("source_code")
    language_id = request.data.get("language_id")

    if not source_code or not language_id:
        return Response({"error": "source_code and language_id are required in the payload."}, status=400)

    user_id = _get_request_user_external_id(request)
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            "SELECT 1 FROM contest_problems WHERE contest_id = %s AND problem_id = %s",
            (str(contest_id), str(problem_id)),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem not found in this contest."}, status=404)

        cursor.execute("SELECT UUID()")
        submission_id = cursor.fetchone()[0]

        cursor.execute(
            """
            INSERT INTO Submissions
            (submission_id, user_id, problem_id, contest_id, language_id, source_code, submitted_at, status, verdict)
            VALUES (%s, %s, %s, %s, %s, %s, NOW(), 'In_Queue', 'Pending')
            """,
            (submission_id, user_id, str(problem_id), str(contest_id), language_id, source_code),
        )
        conn.commit()

        judge_submission(submission_id)

        dict_cursor = conn.cursor(dictionary=True)
        dict_cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   l.name AS language_name, s.source_code, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            WHERE s.submission_id = %s
            LIMIT 1
            """,
            (submission_id,),
        )
        submission_row = dict_cursor.fetchone()
        dict_cursor.close()

        return Response(
            {
                "message": "Submission recorded and sent to judge successfully.",
                "submission_id": submission_id,
                "data": _serialize_submission_row(submission_row) if submission_row else None,
            },
            status=201,
        )
    except Exception as e:
        if conn and conn.is_connected():
            conn.rollback()
        return Response({"error": "An internal error occurred during submission.", "details": str(e)}, status=500)
    finally:
        if cursor:
            cursor.close()
        if conn and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_problem_submission(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)

    source_code = str(request.data.get("source_code", "") or "")
    requested_language_id = request.data.get("language_id")
    requested_language_name = str(request.data.get("language_name", "") or "").strip()

    if not source_code.strip():
        return Response({"error": "Source code is required."}, status=400)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT contest_id, start_time FROM contests WHERE contest_id = %s LIMIT 1",
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        external_user_id = _get_request_user_external_id(request)
        cursor.execute(
            "SELECT 1 FROM contest_participants WHERE contest_id = %s AND user_id = %s LIMIT 1",
            (contest_id, str(external_user_id) if external_user_id is not None else None),
        )
        is_registered = bool(cursor.fetchone())

        if _contest_is_live(contest) and not is_registered and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            "SELECT 1 FROM contest_problems WHERE contest_id = %s AND problem_id = %s LIMIT 1",
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        selected_language_id, languages = _resolve_language_id(cursor, requested_language_id, requested_language_name)

        submission_id = str(uuid.uuid4())
        user_id = _get_request_user_external_id(request)

        cursor.execute(
            """
            INSERT INTO Submissions
            (submission_id, user_id, problem_id, contest_id, language_id, source_code,
             verdict, status, max_execution_time_ms, max_memory_used_kb)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (submission_id, user_id, problem_id, contest_id, selected_language_id, source_code,
             "Pending", "In_Queue", None, None),
        )

        cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   l.name AS language_name, s.source_code, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            WHERE s.submission_id = %s LIMIT 1
            """,
            (submission_id,),
        )
        submission = cursor.fetchone()
        conn.commit()

        return Response(
            {
                "data": _serialize_submission_row(submission),
                "message": "Submission queued successfully.",
                "status": 201,
            },
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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def run_visible_testcases(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)

    source_code = str(request.data.get("source_code", "") or "")
    requested_language_id = request.data.get("language_id")
    requested_language_name = str(request.data.get("language_name", "") or "").strip()

    if not source_code.strip():
        return Response({"error": "Source code is required."}, status=400)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT contest_id, start_time FROM contests WHERE contest_id = %s LIMIT 1",
            (contest_id,),
        )
        contest = cursor.fetchone()
        if not contest:
            return Response({"error": "Contest not found."}, status=404)

        external_user_id = _get_request_user_external_id(request)
        cursor.execute(
            "SELECT 1 FROM contest_participants WHERE contest_id = %s AND user_id = %s LIMIT 1",
            (contest_id, str(external_user_id) if external_user_id is not None else None),
        )
        is_registered = bool(cursor.fetchone())

        if _contest_is_live(contest) and not is_registered and not _is_privileged_contest_user(request):
            return Response({"error": "Contest is running.", "status": 403}, status=403)

        cursor.execute(
            "SELECT 1 FROM contest_problems WHERE contest_id = %s AND problem_id = %s LIMIT 1",
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        selected_language_id, languages = _resolve_language_id(cursor, requested_language_id, requested_language_name)
        if selected_language_id is None:
            return Response({"error": "No supported language is available for this run."}, status=400)

        submission_id = str(uuid.uuid4())
        cursor.execute(
            """
            INSERT INTO Submissions
            (submission_id, user_id, problem_id, contest_id, language_id, source_code,
             verdict, status, max_execution_time_ms, max_memory_used_kb)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                submission_id,
                _get_request_user_external_id(request),
                problem_id,
                contest_id,
                selected_language_id,
                source_code,
                "Pending",
                "In_Queue",
                None,
                None,
            ),
        )
        conn.commit()

        judge_result = judge_submission(
            submission_id,
            only_visible_testcases=True,
            update_contest_scores=False,
            return_details=True,
        ) or {}
        results = judge_result.get("results", [])
        passed_count = int(judge_result.get("passed_cases") or 0)

        cursor.execute("DELETE FROM SubmissionResults WHERE submission_id = %s", (submission_id,))
        cursor.execute("DELETE FROM Submissions WHERE submission_id = %s", (submission_id,))
        conn.commit()

        response_language = next(
            (language for language in languages if str(language["language_id"]) == str(selected_language_id)),
            None,
        )

        return Response(
            {
                "message": "Visible testcases executed successfully.",
                "data": {
                    "contest_id": contest_id,
                    "problem_id": problem_id,
                    "language_id": selected_language_id,
                    "language_name": response_language["name"] if response_language else requested_language_name,
                    "total_cases": int(judge_result.get("total_cases") or len(results)),
                    "passed_cases": passed_count,
                    "verdict": judge_result.get("verdict"),
                    "status": judge_result.get("status"),
                    "execution_time_ms": judge_result.get("execution_time_ms"),
                    "memory_used_kb": judge_result.get("memory_used_kb"),
                    "results": results,
                },
            },
            status=200,
        )
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def my_submissions(request):
    user_id = _get_request_user_external_id(request)
    if user_id is None:
        return Response({"error": "Authenticated user is not linked to a platform account."}, status=403)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   s.source_code, l.name AS language_name, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at,
                   p.title AS problem_title,
                   c.title AS contest_title
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            LEFT JOIN problems p ON p.problem_id = s.problem_id
            LEFT JOIN contests c ON c.contest_id = s.contest_id
            WHERE s.user_id = %s
            ORDER BY s.submitted_at DESC
            LIMIT 100
            """,
            (str(user_id),),
        )
        submissions = []
        for row in cursor.fetchall():
            serialized = _serialize_submission_row(row)
            serialized["problem_title"] = row.get("problem_title")
            serialized["contest_title"] = row.get("contest_title")
            submissions.append(serialized)

        return Response(submissions, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_submission(request, submission_id):
    user_id = _get_request_user_external_id(request)
    if user_id is None:
        return Response({"error": "Authenticated user is not linked to a platform account."}, status=403)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT s.submission_id, s.user_id, s.problem_id, s.contest_id, s.language_id,
                   s.source_code, l.name AS language_name, s.status, s.verdict,
                   s.max_execution_time_ms, s.max_memory_used_kb, s.submitted_at,
                   p.title AS problem_title,
                   c.title AS contest_title
            FROM Submissions s
            LEFT JOIN languages l ON l.language_id = s.language_id
            LEFT JOIN problems p ON p.problem_id = s.problem_id
            LEFT JOIN contests c ON c.contest_id = s.contest_id
            WHERE s.submission_id = %s AND s.user_id = %s
            LIMIT 1
            """,
            (str(submission_id), str(user_id)),
        )
        submission = cursor.fetchone()
        if not submission:
            return Response(
                {"error": "Submission not found or you do not have permission to view it."},
                status=404,
            )
        serialized = _serialize_submission_row(submission)
        serialized["problem_title"] = submission.get("problem_title")
        serialized["contest_title"] = submission.get("contest_title")
        return Response(serialized, status=200)
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if "cursor" in locals() and cursor is not None:
            cursor.close()
        if "conn" in locals() and conn.is_connected():
            conn.close()
