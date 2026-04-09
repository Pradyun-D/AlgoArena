from django.contrib.auth.models import PermissionManager
from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import redirect
from accounts.permissions import IsProblemSetter, IsAdmin,IsProblemSetterOwner,IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response    
from .contest_serializer import ContestSerializer, EditorialSerializer
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



def _get_contests_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            """
            SELECT contest_id, title, description, start_time, end_time, visibility, created_by, created_at
            FROM contests WHERE end_time > (SELECT CURTIME())
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
            FROM contests WHERE end_time <= (SELECT CURTIME())
            ORDER BY end_time DESC, created_at DESC
            """
        )
        return cursor.fetchall()
    except Exception as e:
            return Response({"error": str(e)}, status=500)
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
