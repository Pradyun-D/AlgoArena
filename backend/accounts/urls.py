from django.urls import path
from . import views

urlpatterns = [
    path('auth/', views.auth_page, name='auth_page'),
    path('profile/', views.profile_page, name='profile_page'),
    path('api/register/', views.register_account, name='register_account_api'),
    path('api/login/', views.login_account, name='login_account_api'),
    path('api/session/', views.session_account, name='session_account_api'),
    path('api/logout/', views.logout_account, name='logout_account_api'),
    path('api/profile/<str:user_uuid>/', views.profile_detail, name='profile_detail_api'),
]
