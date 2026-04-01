from django.urls import path, include, re_path
from django.views.generic import TemplateView
from . import views

urlpatterns = [
    # admin routes
    path("api/contests/", views.all_contests_api, name="all_contests_api"),

    path("", views.all_contests, name="all_contests_page"),
    path("create/", views.all_contests, name="create_contest_page"),
    path("<int:contest_id>/", views.contest, name="contest_page"),
    path("<int:contest_id>/delete/", views.delete_contest, name="delete_contest"),

 # pls maintain separate routes for each req (GET AND POST only recognisable)
    # user routes
    # path("<int:contest_id>/register/", views.register_contest, name="register_page"),


    path("<int:contest_id>/problems/", views.contest_problems, name="contest_problems_page"),

    # path("<int:contest_id>/problems/<int:problem_id>/", views.problem_contest, name="problem_contest"),

    path("<int:contest_id>/problems/<int:problem_id>/submit/", views.problem_submit, name="problem_submit"),

    # path("<int:contest_id>/submissions/", views.user_submissions, name="submissions_page"),

    path("<int:contest_id>/leaderboard/", views.contest_leaderboard, name="leaderboard_page"),
]
    
