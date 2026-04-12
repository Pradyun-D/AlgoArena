from django.urls import path, include, re_path
from django.views.generic import TemplateView
from . import views

urlpatterns = [

    # note pls maintain separate routes for put post get if url is same bcs adding permissions is harder using if else ..(becomes clumsy)

    # admin routes
   
    path("admin/dashboard/", views.admin_dashboard_contests, name="admin_dashboard_contests_api"),
    path("admin/dashboard/active/", views.admin_dashboard_active_contests, name="admin_dashboard_active_contests_api"),

    path("create/", views.create_contest, name="create_contest_api"),
    path("<uuid:contest_id>/delete/", views.delete_contest, name="delete_contest_api"),
    path("editorial/create/",views.create_editorial,name="create_editorial_api"),

 
    # user routes
   
    path("", views.all_contests, name="all_contests_api"),
    path("past/", views.past_contests, name="past_contests_api"),
    path("active/",views.active_contests,name="active_contests_api"),
    path("<uuid:contest_id/register",views.register_participant,name="register_participant_api"),
    path("<uuid:contest_id>/details", views.get_contest_info, name="get_contest_info_api"),
    path("<uuid:contest_id>/problems/manage", views.get_contest_problem_editor_data, name="contest_problem_editor_data_api"),
    path("<uuid:contest_id>/problems/<uuid:problem_id>/solve", views.get_problem_solving_data, name="get_problem_solving_data_api"),
    path("<uuid:contest_id>/problems/<uuid:problem_id>/submit", views.create_problem_submission, name="create_problem_submission_api"),
    path("<uuid:contest_id>/problems/<uuid:problem_id>/", views.update_contest_problem, name="update_contest_problem_api"),
    path("<uuid:problem_id>/editorial/",views.get_editorial,name="get_editorial_api"),
    path("editorial/create/", views.create_editorial, name="create_editorial_api"),
    path("editorial/<uuid:problem_id>/", views.get_editorial, name="get_editorial_api"),
    path("<uuid:contest_id>/<uuid:problem_id>/submit/", views.submit_solution, name="submit_solution_api"),
]
    
