"""
Zuvo — Accounts URL Configuration
====================================
All authentication and user-related routes.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ── Auth Endpoints ──
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/set-password/", views.SetPasswordView.as_view(), name="auth-set-password"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),

    # Token refresh — this is provided by simplejwt, no custom code needed
    # Frontend sends: { "refresh": "eyJ..." }
    # Gets back:      { "access": "eyJ..." }  (new access token)
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),

    # ── User Profile ──
    path("users/me/", views.MeView.as_view(), name="user-me"),
]