from django.contrib.auth.models import PermissionManager
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import redirect
import uuid
from accounts.permissions import IsProblemSetter, IsAdmin,IsProblemSetterOwner,IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response    
from .contest_serializer import ContestSerializer, EditorialSerializer, ProblemManageSerializer
from db import get_connection
# from .judge import judge_submission

# Create your views here.

# hardcoding data for now when sql setup we change it

# Return list of registered rounds to javascript for rendering


#-------------------- helpers------------------------------------------------------------

def _build_registered_rounds(contest_history):
    registered_rounds = []

    for entry in contest_history:
        if not isinstance(entry, dict):
            continue

        is_registered = entry.get("registered")
        status = str(entry.get("status", "")).strip()

        if not is_registered and status not in {"Upcoming", "Active"}:
            continue

        if status == "Active":
            subtitle = "Active Now"
        elif entry.get("start_time"):
            subtitle = f"Starts at {entry['start_time']}"
        else:
            subtitle = "Registered"

        registered_rounds.append(
            {
                "title": entry.get("title", "Untitled Contest"),
                "subtitle": subtitle,
                "is_live": status == "Active",
            }
        )

    return registered_rounds[:4]


# ----------------------Dummy sidebar data; will implement later.--------------------------

def _build_sidebar_context(request):
    sidebar = {
        "username": "guest_user",
        "rating": 0,
        "total_solved": 0,
        "avg_rank": None,
        "top_percentile": None,
        "registered_rounds": [],
    }

    if not request.user.is_authenticated:
        return sidebar

    sidebar["username"] = request.user.username or request.user.email.split("@")[0]

    profile = getattr(request.user, "profile", None)
    if profile is None:
        return sidebar

    preferences = profile.preferences if isinstance(profile.preferences, dict) else {}
    contest_history = profile.contest_history if isinstance(profile.contest_history, list) else []

    sidebar["rating"] = preferences.get("rating", preferences.get("contest_rating", 0))
    sidebar["total_solved"] = preferences.get(
        "total_problems_solved",
        preferences.get("problems_solved", 0)
    )
    sidebar["top_percentile"] = preferences.get("top_percentile")
    sidebar["registered_rounds"] = _build_registered_rounds(contest_history)

    ranks = [
        entry.get("rank")
        for entry in contest_history
        if isinstance(entry, dict) and isinstance(entry.get("rank"), (int, float))
    ]

    if ranks:
        sidebar["avg_rank"] = round(sum(ranks) / len(ranks))

    return sidebar


def _ensure_default_languages(cursor):
    default_languages = ["C++20", "Python 3.11", "Java 17"]

    for language_name in default_languages:
        cursor.execute(
            "INSERT IGNORE INTO languages (name) VALUES (%s)",
            (language_name,),
        )

    cursor.execute(
        """
        SELECT language_id, name
        FROM languages
        ORDER BY language_id ASC
        """
    )

    return [
        {
            "language_id": row["language_id"],
            "name": row["name"],
        }
        for row in cursor.fetchall()
    ]


def _serialize_submission_row(row):
    return {
        "submission_id": str(row["submission_id"]),
        "user_id": row.get("user_id"),
        "problem_id": str(row["problem_id"]),
        "contest_id": str(row["contest_id"]) if row.get("contest_id") else None,
        "language_id": row.get("language_id"),
        "language_name": row.get("language_name"),
        "source_code": row.get("source_code", ""),
        "status": row.get("status"),
        "verdict": row.get("verdict"),
        "execution_time_ms": row.get("max_execution_time_ms"),
        "memory_used_kb": row.get("max_memory_used_kb"),
        "submitted_at": row.get("submitted_at"),
    }



def _get_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility, created_by, created_at
            FROM contests WHERE end_time > UTC_TIMESTAMP()
            ORDER BY start_time ASC, created_at DESC
            """
        )
        return cursor.fetchall()  
    except Exception as e:
            return Response({"error": str(e)}, status=500)  
    finally:
        cursor.close()
        conn.close()


def _get_past_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility, created_by, created_at
            FROM contests WHERE end_time <= UTC_TIMESTAMP()
            ORDER BY end_time DESC, created_at DESC
            """
        )
        return cursor.fetchall()
    except Exception as e:
            return Response({"error": str(e)}, status=500)
    finally:
        cursor.close()
        conn.close()

def get_active_contests_data():
    conn=get_connection()
    cursor=conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT UTC_TIMESTAMP() AS now_utc")
        print("db now utc:", cursor.fetchone())

        cursor.execute("""
        SELECT contest_id, title, start_time, end_time
        FROM contests
        ORDER BY created_at DESC
        """)
        print("all contests:", cursor.fetchall())

        rows=cursor.fetchall()
        print(rows)
        return rows
    finally:
        cursor.close()
        conn.close()


# to get all contests

@api_view(["GET"])
@permission_classes([AllowAny])
def all_contests(request):
    return Response(_get_contests_data())


@api_view(["GET"])
@permission_classes([AllowAny])
def past_contests(request):
    return Response(_get_past_contests_data())



# to create a contest (problemsetter/user)

@api_view(["POST"])
@permission_classes([AllowAny])
def create_contest(request):
    payload = dict(request.data)
    contest_data = dict(payload.get("contest", {}))
    contest_data["created_by"] = getattr(request.user, "id", None)
    payload["contest"] = contest_data

    serializer = ContestSerializer(data=payload)
    if serializer.is_valid():
        try:
            serializer.save()
            return Response(serializer.data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
    return Response(serializer.errors, status=400)


# to delete a contest (problemsetter/user)


@api_view(["DELETE"])
@permission_classes([IsProblemSetterOwner]) 
def delete_contest(request,contest_id):
    contest_id = str(contest_id)

    # checking if present in db 
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM contests WHERE contest_id=%s",(contest_id,))
        result=cursor.fetchone()
        if not result:
            return Response({"error":"Contest not found","status":404})
    
    # deleting from db
        cursor.execute("DELETE FROM contests WHERE contest_id=%s",(contest_id,))
        conn.commit()
        return Response({"message":"Contest deleted successfully","status":200})
    except Exception as e:
        return Response({"error": str(e),"status":500})
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()



# getting all problems of a contest

@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_info(request,contest_id):
    contest_id = str(contest_id)
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
            """,
            (contest_id,),
        )
        result_contest=cursor.fetchone()

        if not result_contest:
            return Response({"message":"Contest with this id doesn't exist","status":200}) 
        
        cursor.execute(
            """
            SELECT p.problem_id, p.title, p.description, p.difficulty, p.time_limit_ms,
                   p.memory_limit_kb, p.visibility, cp.max_score
            FROM contest_problems cp
            JOIN problems p ON p.problem_id = cp.problem_id
            WHERE cp.contest_id = %s
            ORDER BY p.created_at ASC
            """,
            (contest_id,),
        )
        result_problem = cursor.fetchall()

        problem_ids = [str(problem["problem_id"]) for problem in result_problem]
        tags_by_problem = {problem_id: [] for problem_id in problem_ids}

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
                {**problem, "problem_id": str(problem["problem_id"]), "tags": tags_by_problem.get(str(problem["problem_id"]), [])}
                for problem in result_problem
            ],
        }

        serializer = ContestSerializer(instance=serialized_payload)
        return Response({"data": serializer.data, "status": 200})
    except Exception as e:
        return Response({"error": str(e),"status":500})
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_contest_problem_editor_data(request, contest_id):
    contest_id = str(contest_id)
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
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

        problem_ids = [str(problem["problem_id"]) for problem in problems]
        tags_by_problem = {problem_id: [] for problem_id in problem_ids}
        testcases_by_problem = {problem_id: [] for problem_id in problem_ids}

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
                testcases_by_problem.setdefault(row["problem_id"], []).append({
                    "testcase_id": row["testcase_id"],
                    "input_data": row.get("input_data", ""),
                    "output_data": row.get("output_data", ""),
                    "is_hidden": bool(row.get("is_hidden", True)),
                })

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
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["GET"])
@permission_classes([AllowAny])
def get_problem_solving_data(request, contest_id, problem_id):
    contest_id = str(contest_id)
    problem_id = str(problem_id)

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility,
                   created_by, created_at
            FROM contests
            WHERE contest_id = %s
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
            """
            SELECT COUNT(*) AS hidden_count
            FROM testcases
            WHERE problem_id = %s AND is_sample = FALSE
            """,
            (problem_id,),
        )
        hidden_testcases = cursor.fetchone() or {"hidden_count": 0}

        languages = _ensure_default_languages(cursor)

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
        submissions = [_serialize_submission_row(row) for row in cursor.fetchall()]

        payload = {
            "contest": contest,
            "problem": {
                **problem,
                "problem_id": str(problem["problem_id"]),
                "tags": tags,
            },
            "visible_testcases": visible_testcases,
            "hidden_testcase_count": hidden_testcases["hidden_count"],
            "languages": languages,
            "submissions": submissions,
        }
        return Response({"data": payload, "status": 200})
    except Exception as e:
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["PUT"])
@permission_classes([AllowAny])
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
            """
            SELECT 1
            FROM contest_problems
            WHERE contest_id = %s AND problem_id = %s
            LIMIT 1
            """,
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
            """
            UPDATE contest_problems
            SET max_score = %s
            WHERE contest_id = %s AND problem_id = %s
            """,
            (validated["max_score"], contest_id, problem_id),
        )

        cursor.execute("DELETE FROM problem_tags WHERE problem_id = %s", (problem_id,))
        for tag_name in validated.get("tags", []):
            cursor.execute("INSERT IGNORE INTO tags (name) VALUES (%s)", (tag_name,))
            cursor.execute("SELECT tag_id FROM tags WHERE name = %s LIMIT 1", (tag_name,))
            tag_row = cursor.fetchone()
            if tag_row:
                cursor.execute(
                    """
                    INSERT IGNORE INTO problem_tags (problem_id, tag_id)
                    VALUES (%s, %s)
                    """,
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
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


@api_view(["POST"])
@permission_classes([AllowAny])
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
            """
            SELECT 1
            FROM contest_problems
            WHERE contest_id = %s AND problem_id = %s
            LIMIT 1
            """,
            (contest_id, problem_id),
        )
        if not cursor.fetchone():
            return Response({"error": "Problem is not attached to this contest."}, status=404)

        languages = _ensure_default_languages(cursor)
        selected_language_id = None

        if requested_language_id is not None:
            cursor.execute(
                """
                SELECT language_id
                FROM languages
                WHERE language_id = %s
                LIMIT 1
                """,
                (requested_language_id,),
            )
            row = cursor.fetchone()
            if row:
                selected_language_id = row["language_id"]

        if selected_language_id is None and requested_language_name:
            cursor.execute(
                "INSERT IGNORE INTO languages (name) VALUES (%s)",
                (requested_language_name,),
            )
            cursor.execute(
                """
                SELECT language_id
                FROM languages
                WHERE name = %s
                LIMIT 1
                """,
                (requested_language_name,),
            )
            row = cursor.fetchone()
            if row:
                selected_language_id = row["language_id"]

        if selected_language_id is None and languages:
            selected_language_id = languages[0]["language_id"]

        submission_id = str(uuid.uuid4())
        user_id = request.user.id if getattr(request.user, "is_authenticated", False) else None

        cursor.execute(
            """
            INSERT INTO Submissions
            (submission_id, user_id, problem_id, contest_id, language_id, source_code,
             verdict, status, max_execution_time_ms, max_memory_used_kb)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                submission_id,
                user_id,
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

        cursor.execute(
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
        if 'conn' in locals() and conn:
            conn.rollback()
        return Response({"error": str(e)}, status=500)
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()


#  creating editorial for a contest 
@api_view(["POST"])
@permission_classes([IsProblemSetterOwner])
def create_editorial(request):
    serializer=EditorialSerializer(data=request.data)
    if serializer.is_valid():
        try:
            serializer.save(created_by=request.user.id)
            return Response({"message":"Editorial created successfully","status":200})
        except Exception as e:
            return Response({"error": str(e),"status":500})
    return Response(serializer.errors,status=400)



# view/get  the editorial of a contest 
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_editorial(request,problem_id):
    try :
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM editorials WHERE problem_id=%s",(problem_id,))
        result=cursor.fetchone()
        if not result:
            return Response({"message":"Editorial not found","status":404})
        return Response({"editorial":result,"status":200})
    except Exception as e:
        return Response({"error":str(e),"status":500})
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()



@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_participant(request, contest_id):
    contest_id = str(contest_id)
    user_id = request.user.id

    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            INSERT INTO contest_participants (contest_id, user_id)
            VALUES (%s, %s)
            """,
            (contest_id, user_id),
        )
        conn.commit()

        return Response({"message": "Registered successfully", "status": 201}, status=201)
    
    except Exception as e:
        return Response({"error": str(e), "status": 500}, status=500)
    
    finally:
        if 'cursor' in locals() and cursor is not None:
            cursor.close()
        if 'conn' in locals() and conn.is_connected():
            conn.close()

@api_view(["GET"])
@permission_classes([AllowAny])
def active_contests(request):
    try:
        activeContests=get_active_contests_data()
        return  Response(activeContests)

    except Exception as e:
            return Response({"error": str(e)}, status=500)
