"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from dj_rest_auth.registration.views import RegisterView, VerifyEmailView, ResendEmailVerificationView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/', include('accounts.urls')),
    path('accounts/', include('allauth.urls')),
    path('api/auth/', include('dj_rest_auth.urls')),  # login, logout, password reset/change, user/

    # Registration URLs (explicit to fix bare TemplateView stubs in dj_rest_auth)
    path('api/auth/registration/', RegisterView.as_view(), name='rest_register'),
    re_path(r'^api/auth/registration/verify-email/?$', VerifyEmailView.as_view(), name='rest_verify_email'),
    re_path(r'^api/auth/registration/resend-email/?$', ResendEmailVerificationView.as_view(), name='rest_resend_email'),
    re_path(
        r'^api/auth/registration/account-confirm-email/(?P<key>[-:\w]+)/?$',
        TemplateView.as_view(template_name='account/confirm_email.html'),
        name='account_confirm_email',
    ),
    re_path(
        r'^api/auth/registration/account-email-verification-sent/?$',
        TemplateView.as_view(template_name='account/verification_sent.html'),
        name='account_email_verification_sent',
    ),
]
