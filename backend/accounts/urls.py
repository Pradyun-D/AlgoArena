from django.urls import path
from . import views

urlpatterns = [
    path('auth/', views.auth_page, name='auth_page'),
    path('profile/', views.profile_page, name='profile_page'),
]
