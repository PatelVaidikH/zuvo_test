"""
Zuvo Backend — Main URL Configuration
=======================================
This is the ROOT url config. It points to each app's own urls.

How it works:
    /api/auth/login/  →  "api/" matches here  →  sends "auth/login/" to accounts.urls
"""

from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    # Django admin panel (for debugging, accessible at /admin/)
    path("admin/", admin.site.urls),

    # All auth endpoints: /api/auth/login/, /api/auth/logout/, etc.
    path("api/", include("accounts.urls")),
]