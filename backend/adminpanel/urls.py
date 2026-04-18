from django.urls import path

from . import views


urlpatterns = [
    path("dashboard/", views.admin_dashboard_contests, name="admin_dashboard_contests"),
    path("dashboard/active/", views.admin_dashboard_active_contests, name="admin_dashboard_active_contests"),
    path("users/", views.admin_users_list, name="admin_users_list"),
    path("users/<uuid:user_uuid>/permissions/", views.admin_update_user_permissions, name="admin_update_user_permissions"),
    path("problem-setters/", views.admin_problem_setters_list, name="admin_problem_setters_list"),
]
