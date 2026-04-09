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


#Create the SQL connection
connection = get_connection()
cursor = connection.cursor()

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
    return [
        {
            "contest_id": "1",
            "title": "Div 2 (Round 1039)",
            "description": "You will be given 6 simple problems and 2 hour 15 minutes to solve them. Note that one of the problems will be further divided into 2 subtasks. Furthermore, some of the problems may be interactive, so please read the guide for interactive problems if you are not familiar with them. This round will be rated for the participants with rating lower than 2100.",
            "start_time": "2026-04-01 12:25:39",
            "end_time": "2026-05-01 18:25:39",
            "visibility": "Public",
            "created_by": "522273ac-2db9-11f1-888d-de2d1da0f60f",
            "created_at": "2026-04-01 16:25:39",
        },
        {
            "contest_id": "2",
            "title": "Div 1 (Round 1040)",
            "description": "The authors of the three best Div. 1 of all time, nifeshe, chromate00, and I, have joined forces to create the Division 1+2 round that will break the internet: Nebius Round 2 (Codeforces Round 1088, Div. 1 + Div. 2), which will be held on Saturday, March 28, 2026 at 20:15UTC+5.5. This round will be combined for Division 1 and Division 2 and will be rated for everyone.",
            "start_time": "2026-06-01 12:25:39",
            "end_time": "2026-06-01 18:25:39",
            "visibility": "Public",
            "created_by": "522273ac-2db9-11f1-888d-de2d1da0f60f",
            "created_at": "2026-04-01 16:25:39",
        },
    ]



# to get all contests

@api_view(["GET"])
@permission_classes([AllowAny])
def all_contests(request):
    return Response(_get_contests_data())



# to create a contest (problemsetter/user)

@api_view(["POST"])
@permission_classes([IsProblemSetter])
def create_contest(request):
    serializer = ContestSerializer(data=request.data)
    if serializer.is_valid():
        try:
            serializer.save(created_by=request.user.id)
            return Response(serializer.data, status=201)
        except Exception as e:
            return Response({"error": str(e)}, status=500)
    return Response(serializer.errors, status=400)


# to delete a contest (problemsetter/user)


@api_view(["DELETE"])
@permission_classes([IsProblemSetterOwner]) 
def delete_contest(request,contest_id):

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
@permission_classes([IsAuthenticated])
def get_contest_info(request,contest_id):
    try:
        conn = get_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM Contests WHERE contest_id = %s", (contest_id,))
        result_contest=cursor.fetchone()

        if not result_contest:
            return Response({"message":"Contest with this id doesn't exist","status":200}) 
        
        cursor.execute("SELECT * FROM problems WHERE problem_id IN (SELECT problem_id FROM contest_problems WHERE contest_id=%s)",(contest_id,))
        result_problem=cursor.fetchall()
        if not result_problem :
            return Response({"message":"Contest has no problems","status":200})
        
        data={
            "contest_info":result_contest,
            "problems":result_problem
        }
        
        return Response({"data":data,"status":200})        
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
