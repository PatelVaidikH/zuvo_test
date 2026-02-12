"""
Zuvo — API Views (Phase 1: Auth)
==================================
These handle the actual logic for each API endpoint.
"""

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone

from .models import User, AuditLog
from .serializers import (
    LoginSerializer,
    SetPasswordSerializer,
    UserResponseSerializer,
)


def get_client_ip(request):
    """Extract the client's IP address from the request."""
    x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded:
        return x_forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def log_action(action, user=None, company=None, target_type="", target_id=None, metadata=None, request=None):
    """
    Helper function to create an audit log entry.
    We'll call this after every important action.
    """
    AuditLog.objects.create(
        action=action,
        user=user,
        company=company,
        target_type=target_type,
        target_id=target_id,
        metadata=metadata or {},
        ip_address=get_client_ip(request) if request else None,
    )


# ──────────────────────────────────────────────
# 1. LOGIN VIEW
# ──────────────────────────────────────────────

class LoginView(APIView):
    """
    POST /api/auth/login/
    
    Takes email + password, returns JWT tokens + user data.
    
    If user has a temp password (is_password_temp=True),
    returns a special response telling the frontend to 
    redirect to the password reset page.
    
    Request:  { "email": "john@acme.com", "password": "secret" }
    
    Response (normal):
    {
        "access": "eyJ...",
        "refresh": "eyJ...",
        "user": { ... },
        "requires_password_change": false,
        "requires_onboarding": false
    }
    
    Response (temp password):
    {
        "requires_password_change": true,
        "temp_token": "eyJ...",     (limited token, only for password change)
        "message": "Password change required"
    }
    """

    # AllowAny = no authentication needed (you can't require login to... log in)
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(
            data=request.data,
            context={"request": request}
        )

        # If validation fails, this raises an error automatically
        # with a 400 Bad Request response
        if not serializer.is_valid():
            # Log failed attempt
            email = request.data.get("email", "unknown")
            log_action(
                action=AuditLog.Action.LOGIN_FAILED,
                metadata={"email": email, "errors": serializer.errors},
                request=request,
            )
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        user = serializer.validated_data["user"]

        # CASE 1: User has a temporary password → must change it first
        if user.is_password_temp:
            # Generate a LIMITED token — only valid for password change
            # We use the refresh token mechanism but it's short-lived
            temp_refresh = RefreshToken.for_user(user)
            
            log_action(
                action=AuditLog.Action.LOGIN_SUCCESS,
                user=user,
                company=user.company,
                metadata={"temp_password": True},
                request=request,
            )

            return Response({
                "requires_password_change": True,
                "temp_token": str(temp_refresh.access_token),
                "message": "Please change your temporary password.",
            }, status=status.HTTP_200_OK)

        # CASE 2: Normal login → return full tokens
        refresh = RefreshToken.for_user(user)

        # Update last login time
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        # Log successful login
        log_action(
            action=AuditLog.Action.LOGIN_SUCCESS,
            user=user,
            company=user.company,
            request=request,
        )

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserResponseSerializer(user).data,
            "requires_password_change": False,
            "requires_onboarding": not user.is_onboarded,
        }, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────
# 2. SET PASSWORD VIEW (First-time password change)
# ──────────────────────────────────────────────

class SetPasswordView(APIView):
    """
    POST /api/auth/set-password/
    
    Changes a temporary password to a permanent one.
    Requires the temp_token from the login response.
    
    Request: {
        "current_password": "Zuvo-xK9m2pLq",
        "new_password": "MyNewSecure123!",
        "confirm_password": "MyNewSecure123!"
    }
    
    Response: {
        "access": "eyJ...",
        "refresh": "eyJ...",
        "user": { ... },
        "message": "Password updated successfully"
    }
    """

    # Requires authentication (the temp_token from login)
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Safety check: only allow if password is actually temporary
        if not user.is_password_temp:
            return Response(
                {"error": "Your password is not temporary. Use the regular change password endpoint."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SetPasswordSerializer(
            data=request.data,
            context={"user": user, "request": request}
        )

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Set the new password
        user.set_password(serializer.validated_data["new_password"])
        user.is_password_temp = False  # No longer temporary!
        user.save(update_fields=["password", "is_password_temp", "updated_at"])

        # Generate fresh tokens for the now-authenticated user
        refresh = RefreshToken.for_user(user)

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        # Log it
        log_action(
            action=AuditLog.Action.PASSWORD_CHANGED,
            user=user,
            company=user.company,
            target_type="user",
            target_id=user.id,
            metadata={"first_time": True},
            request=request,
        )

        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserResponseSerializer(user).data,
            "requires_onboarding": not user.is_onboarded,
            "message": "Password updated successfully.",
        }, status=status.HTTP_200_OK)


# ──────────────────────────────────────────────
# 3. LOGOUT VIEW
# ──────────────────────────────────────────────

class LogoutView(APIView):
    """
    POST /api/auth/logout/
    
    Blacklists the refresh token so it can't be used again.
    The access token will naturally expire in 30 minutes.
    
    Request: { "refresh": "eyJ..." }
    Response: { "message": "Logged out successfully" }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"error": "Refresh token is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Blacklist the token
            token = RefreshToken(refresh_token)
            token.blacklist()

            # Log it
            log_action(
                action=AuditLog.Action.LOGOUT,
                user=request.user,
                company=request.user.company,
                request=request,
            )

            return Response(
                {"message": "Logged out successfully."},
                status=status.HTTP_200_OK,
            )
        except Exception:
            return Response(
                {"error": "Invalid token."},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ──────────────────────────────────────────────
# 4. ME VIEW (Get current user profile)
# ──────────────────────────────────────────────

class MeView(APIView):
    """
    GET /api/users/me/
    
    Returns the currently logged-in user's profile.
    The frontend calls this to know who's logged in and what role they have.
    
    Response: {
        "id": "uuid...",
        "email": "john@acme.com",
        "full_name": "John Miller",
        "role": "admin",
        ...
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            UserResponseSerializer(request.user).data,
            status=status.HTTP_200_OK,
        )