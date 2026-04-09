from django.urls import path, include, re_path
from django.views.generic import TemplateView
from . import views

urlpatterns = [

    # note pls maintain separate routes for put post get if url is same bcs adding permissions is harder using if else ..(becomes clumsy)

    # admin routes
   

    path("create/", views.create_contest, name="create_contest_api"),
    path("<uuid:contest_id>/delete/", views.delete_contest, name="delete_contest_api"),
    path("editorial/create/",views.create_editorial,name="create_editorial_api"),

 
    # user routes
   
    path("", views.all_contests, name="all_contests_api"),
    path("past/", views.past_contests, name="past_contests_api"),
    path("<uuid:contest_id>/details", views.get_contest_info, name="get_contest_info_api"),
    path("<uuid:problem_id>/editorial/",views.get_editorial,name="get_editorial_api"),
    path("editorial/create/", views.create_editorial, name="create_editorial_api"),
    path("editorial/<uuid:problem_id>/", views.get_editorial, name="get_editorial_api"),
]
    
