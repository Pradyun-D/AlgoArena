from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import redirect

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response    

# Create your views here.

# hardcoding data for now when sql setup we change it

# Return list of registered rounds to javascript for rendering

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


# Dummy sidebar data; will implement later.

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


def all_contests(request):
    if request.method == "GET":
        return render(
            request,
            "contests/all_contests.html",
            {
                "contests": _get_contests_data(),
                "sidebar_user": _build_sidebar_context(request),
            }
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def all_contests_api(request):
    return Response(_get_contests_data())

def contest(request, contest_id):
    if request.method == "GET":

        # fetch all contests from MYSQL
        # for now dummy data
        contest = [
            {
                "id": contest_id,
                "title": "Weekly Contest 1",
                "description": "Basic DSA problems",
                "start_time": "2026-04-01 10:00",
                "end_time": "2026-04-01 12:00",
                "status": "Upcoming",
                "visibility": "Public",
            }
        ]

        return (render(request, "contests/contest.html", {"contest": contest}))


def delete_contest(request, contest_id):
    if request.method == "POST":
        # delete from MYSQL HERE using contest_id

        return redirect("all_contest_page")


def contest_problems(request, contest_id):
    if request.method == "GET":
        ## fetch from MYSQL using contest_id
        # for now dummy data
        contest_info = {
            "contest_id": contest_id,
            "title": "Weekly Contest",
            "status": "Active",
        }

        problems = [
            {
                "problem_id": "p1",
                "title": "Two Sum",
                "slug": "two-sum",
                "difficulty": "Easy",
                "time_limit_ms": 1000,
                "memory_limit_kb": 262144,
                "visibility": "Contest_Only",
            },
            {
                "problem_id": "p2",
                "title": "Binary Search",
                "slug": "binary-search",
                "difficulty": "Easy",
                "time_limit_ms": 1000,
                "memory_limit_kb": 262144,
                "visibility": "Contest_Only",
            },
            {
                "problem_id": "p3",
                "title": "Longest Increasing Subsequence",
                "slug": "longest-increasing-subsequence",
                "difficulty": "Medium",
                "time_limit_ms": 1500,
                "memory_limit_kb": 262144,
                "visibility": "Contest_Only",
            },
            {
                "problem_id": "p4",
                "title": "Median of Medians",
                "slug": "median-of-medians",
                "difficulty": "Hard",
                "time_limit_ms": 2000,
                "memory_limit_kb": 262144,
                "visibility": "Contest_Only",
            },
        ]

        return render(
            request,
            "contests/contest_problems.html",
            {
                "contest": contest_info,
                "problems": problems,
            }
        )


def problem_submit(request, contest_id, problem_id):

    if request.method == "GET":
        problem = {
            "problem_id": problem_id,
            "title": "Two Sum",
            "time_limit_ms": 1000,
            "memory_limit_kb": 262144,
        }

        languages = [
            {"id": 1, "name": "C++"},
            {"id": 2, "name": "Python"},
            {"id": 3, "name": "Java"},
        ]

        return render(
            request,
            "contests/problem_submit.html",
            {"problem": problem, "contest_id": contest_id, "languages": languages}
        )

    elif request.method == "POST":
        source_code = request.POST.get("source_code")
        language_id = request.POST.get("language_id")

        submission_id = "sub123"

        return redirect("submissions_page", contest_id=contest_id)


def contest_leaderboard(request, contest_id):
    if request.method == "GET":

        contest = {"contest_id": contest_id, "title": "Weekly Contest 101"}

        leaderboard = [
            {
                "rank": 1,
                "user_id": 101,
                "username": "Alice",
                "problems_solved": 5,
                "current_score": 500,
                "time_penalty_ms": 120000,
            },
            {
                "rank": 2,
                "user_id": 102,
                "username": "Bob",
                "problems_solved": 5,
                "current_score": 500,
                "time_penalty_ms": 150000,
            },
            {
                "rank": 3,
                "user_id": 103,
                "username": "Charlie",
                "problems_solved": 4,
                "current_score": 400,
                "time_penalty_ms": 110000,
            },
            {
                "rank": 4,
                "user_id": 104,
                "username": "David",
                "problems_solved": 3,
                "current_score": 300,
                "time_penalty_ms": 90000,
            },
        ]

        return render(
            request,
            "contests/contest_leaderboard.html",
            {"contest": contest, "leaderboard": leaderboard}
        )
