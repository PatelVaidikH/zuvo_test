"""
Zuvo Backend — Django Settings
================================
This file configures the entire Django backend.
Each section is labeled so you know what it controls.
"""

import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# ──────────────────────────────────────────────
# 1. LOAD ENVIRONMENT VARIABLES
# ──────────────────────────────────────────────
# This reads our .env file so we can use DB_NAME, SECRET_KEY, etc.
# Why? We NEVER put passwords directly in code. The .env file
# is in .gitignore so it won't be uploaded to GitHub.

load_dotenv()

# BASE_DIR = the "backend/" folder. Django uses this to find files.
BASE_DIR = Path(__file__).resolve().parent.parent


# ──────────────────────────────────────────────
# 2. SECURITY SETTINGS
# ──────────────────────────────────────────────

# SECRET_KEY is used to encrypt cookies, tokens, and sessions.
# In production, this MUST be a long random string.
SECRET_KEY = os.getenv("SECRET_KEY", "fallback-insecure-key")

# DEBUG = True shows detailed error pages. 
# NEVER set True in production (hackers can see your code).
DEBUG = os.getenv("DEBUG", "False") == "True"

# Which domains can access our backend.
# In production, this would be ["zuvo.app", "api.zuvo.app"]
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]


# ──────────────────────────────────────────────
# 3. INSTALLED APPS
# ──────────────────────────────────────────────
# Think of this as a list of "features" our project uses.
# Django comes with some built-in, and we add our own.

INSTALLED_APPS = [
    # --- Django built-in apps ---
    "django.contrib.admin",        # Django's admin panel (we won't use much)
    "django.contrib.auth",         # User authentication system
    "django.contrib.contenttypes", # Tracks which models exist
    "django.contrib.sessions",     # Server-side sessions
    "django.contrib.messages",     # Flash messages
    "django.contrib.staticfiles",  # Serves CSS/JS files

    # --- Third-party apps ---
    "rest_framework",              # Django REST Framework (our API toolkit)
    "rest_framework_simplejwt",    # JWT authentication
    "rest_framework_simplejwt.token_blacklist", 
    "corsheaders",                 # Allow frontend to talk to backend

    # --- Our apps ---
    "accounts",                    # Users, auth, invites (Phase 1)
]


# ──────────────────────────────────────────────
# 4. MIDDLEWARE
# ──────────────────────────────────────────────
# Middleware = code that runs on EVERY request before it reaches your views.
# Think of them as security checkpoints at the door.
# Order matters! They run top-to-bottom on requests.

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",        # MUST be first — handles CORS
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]


# ──────────────────────────────────────────────
# 5. URL CONFIGURATION
# ──────────────────────────────────────────────
# Tells Django where to find our URL routing file.

ROOT_URLCONF = "zuvo_backend.urls"


# ──────────────────────────────────────────────
# 6. TEMPLATES (for Django admin, not for our frontend)
# ──────────────────────────────────────────────

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "zuvo_backend.wsgi.application"


# ──────────────────────────────────────────────
# 7. DATABASE
# ──────────────────────────────────────────────
# This connects Django to our PostgreSQL database.
# The values come from the .env file we created in Step 5.

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",  # Use PostgreSQL
        "NAME": os.getenv("DB_NAME", "zuvo_db"),
        "USER": os.getenv("DB_USER", "zuvo_user"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}


# ──────────────────────────────────────────────
# 8. CUSTOM USER MODEL
# ──────────────────────────────────────────────
# Django has a built-in User model, but it's too basic for us.
# We're telling Django: "Don't use your default User.
# Use OUR custom User model in the accounts app instead."
#
# IMPORTANT: This MUST be set BEFORE running any migrations.

AUTH_USER_MODEL = "accounts.User"


# ──────────────────────────────────────────────
# 9. PASSWORD VALIDATION
# ──────────────────────────────────────────────
# These are server-side password rules.
# Even if frontend validates, backend ALSO checks (never trust the client).

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
     "OPTIONS": {"min_length": 8}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]


# ──────────────────────────────────────────────
# 10. INTERNATIONALIZATION
# ──────────────────────────────────────────────

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"          # Store all times in UTC, convert on frontend
USE_I18N = True
USE_TZ = True              # Enable timezone-aware datetimes


# ──────────────────────────────────────────────
# 11. STATIC FILES
# ──────────────────────────────────────────────

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"


# ──────────────────────────────────────────────
# 12. CORS SETTINGS
# ──────────────────────────────────────────────
# CORS = Cross-Origin Resource Sharing
# Our frontend (localhost:3000) and backend (localhost:8000) are 
# on different ports. Browsers block this by default.
# CORS headers tell the browser: "It's okay, let them talk."

CORS_ALLOWED_ORIGINS = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
]

CORS_ALLOW_CREDENTIALS = True  # Allow cookies to be sent


# ──────────────────────────────────────────────
# 13. DJANGO REST FRAMEWORK SETTINGS
# ──────────────────────────────────────────────
# This configures how our API works.

REST_FRAMEWORK = {
    # How do we authenticate API requests?
    # JWTAuthentication = check the Authorization header for a token
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),

    # By default, all endpoints require login.
    # We'll override this for specific views (like login itself).
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),

    # Pagination: return max 20 items per page
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,

    # Use JSON for all responses
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
}


# ──────────────────────────────────────────────
# 14. JWT TOKEN SETTINGS
# ──────────────────────────────────────────────
# JWT = JSON Web Token. This is how we keep users logged in.
#
# How it works:
# 1. User logs in → backend creates 2 tokens:
#    - Access Token (short-lived, 30 min) — sent with every API request
#    - Refresh Token (long-lived, 7 days) — used to get a new access token
# 2. Frontend stores both tokens
# 3. When access token expires, frontend uses refresh token to get a new one
# 4. When refresh token expires, user must log in again

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("ACCESS_TOKEN_LIFETIME_MINUTES", 30))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("REFRESH_TOKEN_LIFETIME_DAYS", 7))
    ),
    "ROTATE_REFRESH_TOKENS": True,       # New refresh token on each refresh
    "BLACKLIST_AFTER_ROTATION": True,     # Old refresh token can't be reused
    "AUTH_HEADER_TYPES": ("Bearer",),     # Authorization: Bearer <token>
}


# ──────────────────────────────────────────────
# 15. MEDIA FILES (User uploads — avatars, attachments)
# ──────────────────────────────────────────────

MEDIA_URL = "/media/"
MEDIA_ROOT = os.path.join(BASE_DIR, "media")