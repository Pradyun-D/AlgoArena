from django.shortcuts import render
from django.http import HttpResponse
from django.shortcuts import redirect

# Create your views here.

# hardcoding data for now when sql setup we change it


def all_contests(request):
    if request.method == "GET":
        contests = [
            {"contest_id": 1, "title": "Weekly Contest"},
            {"contest_id": 2, "title": "Monthly Contest"},
        ]
        return (render(request, "contests/all_contests.html", {"contests": contests}))


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
