"""
Zuvo — Custom Permissions
===========================
These control WHO can access each endpoint.
"""

from rest_framework.permissions import BasePermission


class IsSuperAdmin(BasePermission):
    """
    Only allows access to Super Admin users.
    
    Usage in a view:
        permission_classes = [IsSuperAdmin]
    
    How it works:
    1. Django REST calls has_permission() before running the view
    2. If it returns True → view runs normally
    3. If it returns False → 403 Forbidden response automatically
    """

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "super_admin"
        )


class IsAdmin(BasePermission):
    """Only allows Company Admins (or Super Admin)."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ["super_admin", "admin"]
        )


class IsDeptHeadOrAbove(BasePermission):
    """Allows Dept Head, Admin, or Super Admin."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role in ["super_admin", "admin", "dept_head"]
        )