from django.urls import path
from . import views

urlpatterns = [

    path('', views.all_contests, name='all_contests'),
    path('past/', views.past_contests, name='past_contests'),
    path('active/', views.active_contests, name='active_contests'),

    path('drafts/', views.list_drafts, name='list_drafts'),
    path('drafts/create/', views.create_draft, name='create_draft'),
    path('drafts/<uuid:contest_id>/', views.draft_detail, name='draft_detail'),
    path('drafts/<uuid:contest_id>/publish/', views.publish_draft, name='publish_draft'),

    path('create/', views.create_contest, name='create_contest'),
    path('<uuid:contest_id>/edit/', views.contest_metadata_detail, name='contest_metadata_detail'),
    path('<uuid:contest_id>/delete/', views.delete_contest, name='delete_contest'),

    path('<uuid:contest_id>/details/', views.get_contest_info, name='get_contest_info'),
    path('<uuid:contest_id>/registration-status/', views.get_contest_registration_status, name='get_contest_registration_status'),

    path('<uuid:contest_id>/problems/manage', views.get_contest_problem_editor_data, name='get_contest_problem_editor_data'),
    path('<uuid:contest_id>/problems/<uuid:problem_id>/solve', views.get_problem_solving_data, name='get_problem_solving_data'),
    path('<uuid:contest_id>/problems/<uuid:problem_id>/update', views.update_contest_problem, name='update_contest_problem'),
    path('<uuid:contest_id>/problems/<uuid:problem_id>/submit', views.create_problem_submission, name='create_problem_submission'),

    path('submissions/', views.my_submissions, name='my_submissions'),
    path('submissions/<uuid:submission_id>/', views.get_submission, name='get_submission'),

    path('<uuid:contest_id>/register/', views.register_participant, name='register_participant'),
]
