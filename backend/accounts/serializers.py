"""
Zuvo — Serializers (Phase 1)
==============================
Serializers validate incoming API data and format outgoing responses.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import User, Company


# ──────────────────────────────────────────────
# 1. LOGIN SERIALIZER
# ──────────────────────────────────────────────

class LoginSerializer(serializers.Serializer):
    """
    Validates login credentials.
    
    Input:  { "email": "john@acme.com", "password": "secret" }
    Output: validated user object (if credentials are correct)
    """

    email = serializers.EmailField(
        required=True,
        help_text="User's email address (their username)"
    )
    password = serializers.CharField(
        required=True,
        write_only=True,    # Never include password in responses
        help_text="User's password"
    )

    def validate(self, attrs):
        """
        This runs when the serializer checks the data.
        We verify the email + password combo is correct.
        """
        email = attrs.get("email", "").lower().strip()
        password = attrs.get("password", "")

        if not email or not password:
            raise serializers.ValidationError(
                "Both email and password are required."
            )

        # authenticate() is Django's built-in function.
        # It checks: does this email exist? Does the password match the hash?
        user = authenticate(
            request=self.context.get("request"),
            username=email,     # Our USERNAME_FIELD is 'email'
            password=password,
        )

        if user is None:
            raise serializers.ValidationError(
                "Invalid email or password."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "This account has been deactivated. Contact your administrator."
            )

        # Check if the user's company is active (skip for super admin)
        if user.company and not user.company.is_active:
            raise serializers.ValidationError(
                "Your company account has been deactivated. Contact support."
            )

        # Attach the user to the validated data so the view can use it
        attrs["user"] = user
        return attrs


# ──────────────────────────────────────────────
# 2. SET PASSWORD SERIALIZER (First-time reset)
# ──────────────────────────────────────────────

class SetPasswordSerializer(serializers.Serializer):
    """
    For first-time password change (temp password → permanent).
    
    Input: {
        "current_password": "Zuvo-xK9m2pLq",   (the temp one)
        "new_password": "MyNewSecure123!",
        "confirm_password": "MyNewSecure123!"
    }
    """

    current_password = serializers.CharField(
        required=True,
        write_only=True,
        help_text="The temporary password shared by admin"
    )
    new_password = serializers.CharField(
        required=True,
        write_only=True,
        help_text="New password (min 8 chars, mixed case, number, special)"
    )
    confirm_password = serializers.CharField(
        required=True,
        write_only=True,
        help_text="Must match new_password"
    )

    def validate_current_password(self, value):
        """Check if the current (temp) password is correct."""
        user = self.context.get("user")
        if not user.check_password(value):
            raise serializers.ValidationError(
                "Current password is incorrect."
            )
        return value

    def validate_new_password(self, value):
        """Run Django's built-in password validators."""
        # This checks: min length, not too common, not all numeric, etc.
        validate_password(value)
        return value

    def validate(self, attrs):
        """Check that new_password and confirm_password match."""
        if attrs["new_password"] != attrs["confirm_password"]:
            raise serializers.ValidationError({
                "confirm_password": "Passwords do not match."
            })

        # Don't allow setting the same password as current
        if attrs["current_password"] == attrs["new_password"]:
            raise serializers.ValidationError({
                "new_password": "New password must be different from current password."
            })

        return attrs


# ──────────────────────────────────────────────
# 3. USER RESPONSE SERIALIZER
# ──────────────────────────────────────────────
# This formats user data for API responses.
# We control exactly what gets sent back (no password hash!).

class UserResponseSerializer(serializers.ModelSerializer):
    """
    Formats user data for API responses.
    
    Output: {
        "id": "uuid...",
        "email": "john@acme.com",
        "full_name": "John Miller",
        "role": "admin",
        "company_name": "Acme Corporation",
        ...
    }
    """

    company_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "contact_number",
            "avatar_url",
            "role",
            "job_title",
            "company",
            "company_name",
            "is_password_temp",
            "is_onboarded",
            "timezone",
            "theme_preference",
            "last_login",
            "created_at",
        ]
        # These fields are READ-ONLY — can't be changed through this serializer
        read_only_fields = fields

    def get_company_name(self, obj):
        """Get the company name for display (instead of just the UUID)."""
        return obj.company.name if obj.company else None