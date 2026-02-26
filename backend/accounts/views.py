"""
Zuvo — API Views 
==================================
These handle the actual logic for each API endpoint.
"""
from django.db import models  # for models.Count, models.Q
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.utils import timezone
from datetime import timedelta
from rest_framework.generics import get_object_or_404
from .models import (
    User, Company, AuditLog, PasswordReset,
    Team, TeamMember, BoardColumn, Task, TaskAssignee,
    Comment, UserTeamView,
)
from .permissions import IsSuperAdmin, IsAdmin, IsDeptHeadOrAbove
from .utils import generate_temp_password
from .serializers import (
    LoginSerializer,
    SetPasswordSerializer,
    UserResponseSerializer,
    CompanyListSerializer,
    CompanyCreateSerializer,
    CompanyDetailSerializer,
    CompanyUpdateSerializer,
    CreateUserSerializer,
    UserListSerializer,
    UserUpdateSerializer,
    OnboardingSerializer,
    TeamListSerializer,
    TeamDetailSerializer,
    CreateTeamSerializer,
    UpdateTeamSerializer,
    AddTeamMemberSerializer,
    BulkAddTeamMemberSerializer,
    InviteTeamMemberSerializer,
    ChangeTeamRoleSerializer,
    TeamMemberSerializer,
    CreateCompanyMemberSerializer,
    BoardColumnSerializer,
    TaskCardSerializer,
    TaskDetailSerializer,
    CreateTaskSerializer,
    UpdateTaskSerializer,
    MoveTaskSerializer,
    ReorderColumnsSerializer,
    TaskAssigneeSerializer,
    BulkTaskActionSerializer,
    CommentSerializer,
    CreateCommentSerializer,
    EditCommentSerializer,
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


def create_system_comment(task, content):
    """
    Create an auto-generated system comment on a task.
    Called when task status, priority, or assignees change.
    These build an inline activity trail visible in the task detail panel.
    """
    Comment.objects.create(
        task=task,
        user=None,
        content=content,
        is_system=True,
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
    

# ══════════════════════════════════════════════
#  SUPER ADMIN — COMPANY MANAGEMENT
# ══════════════════════════════════════════════


class ClientListCreateView(APIView):
    """
    GET  /api/admin/clients/     → List all companies
    POST /api/admin/clients/     → Create a new company
    """

    permission_classes = [IsSuperAdmin]

    def get(self, request):
        """List all companies with search and filter support."""

        companies = Company.objects.all()

        # Search by name
        search = request.query_params.get("search", "").strip()
        if search:
            companies = companies.filter(name__icontains=search)
            # __icontains = case-insensitive "contains" search
            # "acme" matches "Acme Corporation"

        # Filter by active status
        status_filter = request.query_params.get("status", "").strip()
        if status_filter == "active":
            companies = companies.filter(is_active=True)
        elif status_filter == "inactive":
            companies = companies.filter(is_active=False)

        serializer = CompanyListSerializer(companies, many=True)
        # many=True tells the serializer we're passing a LIST, not one object

        return Response({
            "count": companies.count(),
            "results": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request):
        """Create a new client company."""

        serializer = CompanyCreateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = serializer.save()

        # Log it
        log_action(
            action=AuditLog.Action.COMPANY_CREATED,
            user=request.user,
            company=company,
            target_type="company",
            target_id=company.id,
            metadata={"name": company.name},
            request=request,
        )

        return Response(
            CompanyDetailSerializer(company).data,
            status=status.HTTP_201_CREATED,
        )


class ClientDetailView(APIView):
    """
    GET    /api/admin/clients/{id}/  → Get company detail
    PATCH  /api/admin/clients/{id}/  → Update company
    DELETE /api/admin/clients/{id}/  → Deactivate company
    """

    permission_classes = [IsSuperAdmin]

    def get_company(self, pk):
        """Helper to get a company by ID or return 404."""
        return get_object_or_404(Company, pk=pk)

    def get(self, request, pk):
        """Get company detail with stats."""
        company = self.get_company(pk)
        return Response(
            CompanyDetailSerializer(company).data,
            status=status.HTTP_200_OK,
        )

    def patch(self, request, pk):
        """Update company name/description."""
        company = self.get_company(pk)

        serializer = CompanyUpdateSerializer(
            company,               # The existing object
            data=request.data,
            partial=True,          # Allow partial updates (not all fields required)
        )

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        company = serializer.save()

        log_action(
            action=AuditLog.Action.COMPANY_UPDATED,
            user=request.user,
            company=company,
            target_type="company",
            target_id=company.id,
            metadata=request.data,
            request=request,
        )

        return Response(
            CompanyDetailSerializer(company).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        """Soft-delete: set is_active=False."""
        company = self.get_company(pk)

        company.is_active = False
        company.save(update_fields=["is_active", "updated_at"])

        # Also deactivate all users in this company
        company.users.update(is_active=False)

        log_action(
            action=AuditLog.Action.COMPANY_DEACTIVATED,
            user=request.user,
            company=company,
            target_type="company",
            target_id=company.id,
            metadata={"name": company.name},
            request=request,
        )

        return Response(
            {"message": f"{company.name} has been deactivated."},
            status=status.HTTP_200_OK,
        )


# ══════════════════════════════════════════════
#  SUPER ADMIN — USER MANAGEMENT (within a company)
# ══════════════════════════════════════════════


class ClientUserListCreateView(APIView):
    """
    GET  /api/admin/clients/{id}/users/   → List users in company
    POST /api/admin/clients/{id}/users/   → Create user with temp password
    """

    permission_classes = [IsSuperAdmin]

    def get_company(self, pk):
        return get_object_or_404(Company, pk=pk)

    def get(self, request, pk):
        """List all users in a company."""
        company = self.get_company(pk)
        users = User.objects.filter(company=company)

        # Optional search
        search = request.query_params.get("search", "").strip()
        if search:
            users = users.filter(full_name__icontains=search) | users.filter(
                email__icontains=search
            )

        serializer = UserListSerializer(users, many=True)

        return Response({
            "count": users.count(),
            "company": CompanyDetailSerializer(company).data,
            "results": serializer.data,
        }, status=status.HTTP_200_OK)

    def post(self, request, pk):
        """
        Create a new user in a company.
        Auto-generates a temp password and returns it in the response.
        """
        company = self.get_company(pk)

        # Check company is active
        if not company.is_active:
            return Response(
                {"error": "Cannot add users to a deactivated company."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CreateUserSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate temp password
        temp_password = generate_temp_password()

        # Create the user
        user = User.objects.create_user(
            email=serializer.validated_data["email"],
            password=temp_password,
            full_name=serializer.validated_data["full_name"],
            contact_number=serializer.validated_data.get("contact_number", ""),
            role=serializer.validated_data["role"],
            email_secondary=serializer.validated_data.get("email_secondary"),
            company=company,
            created_by=request.user,
            is_password_temp=True,      # Force password change on first login
            is_onboarded=False,         # Force onboarding after password change
        )

        # Log it
        log_action(
            action=AuditLog.Action.USER_CREATED,
            user=request.user,
            company=company,
            target_type="user",
            target_id=user.id,
            metadata={
                "created_user_email": user.email,
                "created_user_role": user.role,
            },
            request=request,
        )

        # Return user data + the plain-text temp password
        # This is the ONLY time the password is ever visible!
        return Response({
            "user": UserListSerializer(user).data,
            "credentials": {
                "username": user.email,
                "temporary_password": temp_password,
            },
            "message": (
                "User created successfully. "
                "Share the credentials securely — "
                "the password is shown only once."
            ),
        }, status=status.HTTP_201_CREATED)


class ClientUserDetailView(APIView):
    """
    PATCH  /api/admin/clients/{id}/users/{uid}/  → Edit user
    DELETE /api/admin/clients/{id}/users/{uid}/  → Deactivate user
    """

    permission_classes = [IsSuperAdmin]

    def get_user(self, company_pk, user_pk):
        """Get a user ensuring they belong to the specified company."""
        return get_object_or_404(
            User,
            pk=user_pk,
            company_id=company_pk,
        )

    def patch(self, request, pk, uid):
        """Update user details."""
        user = self.get_user(pk, uid)

        serializer = UserUpdateSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Track what changed for audit log
        changes = {}

        validated = serializer.validated_data

        if "full_name" in validated:
            changes["full_name"] = {"from": user.full_name, "to": validated["full_name"]}
            user.full_name = validated["full_name"]

        if "contact_number" in validated:
            user.contact_number = validated["contact_number"]

        if "role" in validated and validated["role"] != user.role:
            changes["role"] = {"from": user.role, "to": validated["role"]}
            user.role = validated["role"]

            # Extra audit for role change
            log_action(
                action=AuditLog.Action.USER_ROLE_CHANGED,
                user=request.user,
                company=user.company,
                target_type="user",
                target_id=user.id,
                metadata=changes["role"],
                request=request,
            )

        if "email_secondary" in validated:
            user.email_secondary = validated["email_secondary"]

        if "is_active" in validated:
            changes["is_active"] = {"from": user.is_active, "to": validated["is_active"]}
            user.is_active = validated["is_active"]

        user.save()

        log_action(
            action=AuditLog.Action.USER_UPDATED,
            user=request.user,
            company=user.company,
            target_type="user",
            target_id=user.id,
            metadata=changes,
            request=request,
        )

        return Response(
            UserListSerializer(user).data,
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk, uid):
        """Soft-delete: deactivate user."""
        user = self.get_user(pk, uid)

        # Prevent deactivating yourself
        if user.id == request.user.id:
            return Response(
                {"error": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.save(update_fields=["is_active", "updated_at"])

        log_action(
            action=AuditLog.Action.USER_DEACTIVATED,
            user=request.user,
            company=user.company,
            target_type="user",
            target_id=user.id,
            metadata={"email": user.email},
            request=request,
        )

        return Response(
            {"message": f"{user.full_name} has been deactivated."},
            status=status.HTTP_200_OK,
        )


class ClientUserResetPasswordView(APIView):
    """
    POST /api/admin/clients/{id}/users/{uid}/reset-password/
    
    Generate a new temp password for a user.
    Use case: Super Admin forgot to share the original password,
    or user lost it before logging in.
    """

    permission_classes = [IsSuperAdmin]

    def post(self, request, pk, uid):
        user = get_object_or_404(User, pk=uid, company_id=pk)

        # Generate new temp password
        temp_password = generate_temp_password()

        # Set it
        user.set_password(temp_password)
        user.is_password_temp = True
        user.save(update_fields=["password", "is_password_temp", "updated_at"])

        log_action(
            action=AuditLog.Action.TEMP_PASSWORD_SET,
            user=request.user,
            company=user.company,
            target_type="user",
            target_id=user.id,
            metadata={"reset_by": request.user.email},
            request=request,
        )

        return Response({
            "user": UserListSerializer(user).data,
            "credentials": {
                "username": user.email,
                "temporary_password": temp_password,
            },
            "message": "Password has been reset. Share the new credentials securely.",
        }, status=status.HTTP_200_OK)
    
# ──────────────────────────────────────────────
# 5. ONBOARDING VIEW
# ──────────────────────────────────────────────

class OnboardingView(APIView):
    """
    POST /api/users/onboarding/
    
    Completes the first-time user onboarding.
    Sets profile info + preferences, marks user as onboarded.
    
    After this, is_onboarded = True and user goes to their home page.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user

        # Safety check
        if user.is_onboarded:
            return Response(
                {"error": "You have already completed onboarding."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = OnboardingSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        # Update user profile
        user.full_name = data["full_name"]
        user.job_title = data["job_title"]
        user.timezone = data.get("timezone", "UTC")

        if data.get("avatar_url"):
            user.avatar_url = data["avatar_url"]

        user.is_onboarded = True

        user.save(update_fields=[
            "full_name", "job_title", "timezone",
            "avatar_url", "is_onboarded", "updated_at",
        ])

        # Log it
        log_action(
            action=AuditLog.Action.ONBOARDING_COMPLETED,
            user=user,
            company=user.company,
            target_type="user",
            target_id=user.id,
            metadata={
                "job_title": user.job_title,
            },
            request=request,
        )

        return Response({
            "user": UserResponseSerializer(user).data,
            "message": "Onboarding completed successfully!",
        }, status=status.HTTP_200_OK)
    

# ══════════════════════════════════════════════════════
#  TEAM VIEWS
# ══════════════════════════════════════════════════════


class TeamListCreateView(APIView):
    """
    GET  /api/teams/          → List teams I belong to (or all if Admin)
    POST /api/teams/          → Create a new team (Admin only)
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        member_team_ids = TeamMember.objects.filter(
            user=user
        ).values_list("team_id", flat=True)

        if user.role == "admin":
            # Admins see teams they are a member of OR teams they created
            teams = Team.objects.filter(
                company=user.company, is_archived=False
            ).filter(
                models.Q(id__in=member_team_ids) | models.Q(created_by=user)
            ).annotate(
                member_count=models.Count("members")
            ).distinct()
        else:
            # Dept Heads & Employees see only teams they are a member of
            teams = Team.objects.filter(
                id__in=member_team_ids, is_archived=False
            ).annotate(
                member_count=models.Count("members")
            )

        serializer = TeamListSerializer(teams, many=True)
        return Response({
            "teams": serializer.data,
            "count": teams.count(),
        })

    def post(self, request):
        user = request.user

        # Admins and Dept Heads can create teams
        if user.role not in ("admin", "dept_head"):
            return Response(
                {"error": "Only admins and department heads can create teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = CreateTeamSerializer(
            data=request.data,
            context={"company": user.company},
        )

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        team = Team.objects.create(
            company=user.company,
            name=data["name"],
            description=data.get("description", ""),
            icon=data.get("icon", "📁"),
            color=data.get("color", "#FF6B6B"),
            created_by=user,
        )

        # Dept heads must be auto-added as members so they can see their own team.
        # Admins can see teams they created (via created_by filter) without needing membership.
        if user.role == "dept_head":
            TeamMember.objects.create(
                team=team,
                user=user,
                team_role="dept_head",
                added_by=user,
            )

        log_action(
            action=AuditLog.Action.TEAM_CREATED,
            user=user,
            company=user.company,
            target_type="team",
            target_id=team.id,
            metadata={"team_name": team.name, "team_id": str(team.id)},
            request=request,
        )

        # Return full detail — re-fetch with annotation so member_count is set
        team = Team.objects.annotate(
            member_count=models.Count("members")
        ).get(id=team.id)
        return Response({
            "team": TeamListSerializer(team).data,
            "message": f"Team '{team.name}' created successfully!",
        }, status=status.HTTP_201_CREATED)


class TeamDetailView(APIView):
    """
    GET    /api/teams/{id}/    → Team detail with members
    PATCH  /api/teams/{id}/    → Update team (Admin or Dept Head of team)
    DELETE /api/teams/{id}/    → Archive team (Admin only)
    """

    permission_classes = [IsAuthenticated]

    def _get_team(self, team_id, user):
        """Get team if user has access (member, or admin who created it)."""
        try:
            team = Team.objects.annotate(
                member_count=models.Count("members")
            ).get(id=team_id, company=user.company, is_archived=False)
        except Team.DoesNotExist:
            return None

        if user.role == "admin":
            is_creator = team.created_by_id == user.id
            is_member = TeamMember.objects.filter(team=team, user=user).exists()
            if not (is_creator or is_member):
                return None
        else:
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return None

        return team

    def get(self, request, team_id):
        team = self._get_team(team_id, request.user)
        if not team:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TeamDetailSerializer(team)
        return Response({"team": serializer.data})

    def patch(self, request, team_id):
        user = request.user
        team = self._get_team(team_id, user)

        if not team:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Permission: Admin or Dept Head of this team
        if user.role == "admin":
            pass  # allowed
        elif user.role == "dept_head":
            if not TeamMember.objects.filter(
                team=team, user=user, team_role="dept_head"
            ).exists():
                return Response(
                    {"error": "You don't have permission to edit this team."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {"error": "You don't have permission to edit this team."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = UpdateTeamSerializer(
            data=request.data,
            context={"company": user.company, "team_id": team_id},
        )

        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        update_fields = ["updated_at"]

        for field in ["name", "description", "icon", "color"]:
            if field in data:
                setattr(team, field, data[field])
                update_fields.append(field)

        team.save(update_fields=update_fields)

        log_action(
            action=AuditLog.Action.TEAM_UPDATED,
            user=user,
            company=user.company,
            target_type="team",
            target_id=team.id,
            metadata={"updated_fields": update_fields, "team_name": team.name, "team_id": str(team.id)},
            request=request,
        )

        team = self._get_team(team_id, user)  # re-fetch with annotation
        return Response({
            "team": TeamDetailSerializer(team).data,
            "message": "Team updated successfully!",
        })

    def delete(self, request, team_id):
        user = request.user

        if user.role != "admin":
            return Response(
                {"error": "Only admins can archive teams."},
                status=status.HTTP_403_FORBIDDEN,
            )

        team = self._get_team(team_id, user)
        if not team:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        team.is_archived = True
        team.save(update_fields=["is_archived", "updated_at"])

        log_action(
            action=AuditLog.Action.TEAM_ARCHIVED,
            user=user,
            company=user.company,
            target_type="team",
            target_id=team.id,
            metadata={"team_name": team.name, "team_id": str(team.id)},
            request=request,
        )

        return Response({"message": f"Team '{team.name}' archived."})


class TeamMembersView(APIView):
    """
    GET  /api/teams/{id}/members/          → List team members
    POST /api/teams/{id}/members/          → Add existing user to team
    """

    permission_classes = [IsAuthenticated]

    def _get_team_with_permission(self, team_id, user, require_manage=False):
        """Get team + check permissions. Admin: member OR creator. Others: must be member."""
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return None, "Team not found."

        if user.role == "admin":
            is_creator = team.created_by_id == user.id
            is_member = TeamMember.objects.filter(team=team, user=user).exists()
            if not (is_creator or is_member):
                return None, "Team not found."
            # Admins (creator or member) can always manage
            return team, None
        else:
            membership = TeamMember.objects.filter(team=team, user=user).first()
            if not membership:
                return None, "Team not found."
            if require_manage and membership.team_role != "dept_head":
                return None, "You don't have permission to manage members."
            return team, None

    def get(self, request, team_id):
        team, error = self._get_team_with_permission(team_id, request.user)
        if error:
            return Response({"error": error}, status=status.HTTP_404_NOT_FOUND)

        members = TeamMember.objects.filter(team=team).select_related("user")
        serializer = TeamMemberSerializer(members, many=True)

        return Response({
            "team_id": str(team.id),
            "team_name": team.name,
            "members": serializer.data,
            "count": members.count(),
        })

    def post(self, request, team_id):
        user = request.user
        team, error = self._get_team_with_permission(
            team_id, user, require_manage=True
        )
        if error:
            return Response(
                {"error": error},
                status=status.HTTP_403_FORBIDDEN if "permission" in error else status.HTTP_404_NOT_FOUND,
            )

        serializer = AddTeamMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        # Verify the user exists and belongs to the same company
        try:
            target_user = User.objects.get(
                id=data["user_id"],
                company=user.company,
                is_active=True,
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found in your company."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check not already a member
        if TeamMember.objects.filter(team=team, user=target_user).exists():
            return Response(
                {"error": f"{target_user.full_name} is already in this team."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        membership = TeamMember.objects.create(
            team=team,
            user=target_user,
            team_role=data["team_role"],
            added_by=user,
        )

        log_action(
            action=AuditLog.Action.MEMBER_ADDED,
            user=user,
            company=user.company,
            target_type="team_member",
            target_id=membership.id,
            metadata={
                "team_name": team.name,
                "team_id": str(team.id),
                "member_name": target_user.full_name,
                "team_role": data["team_role"],
            },
            request=request,
        )

        return Response({
            "member": TeamMemberSerializer(membership).data,
            "message": f"{target_user.full_name} added to {team.name}!",
        }, status=status.HTTP_201_CREATED)


class TeamMembersBulkAddView(APIView):
    """
    POST /api/teams/{id}/members/bulk/

    Add multiple existing company users to a team in one request.
    Input: { "members": [{"user_id": "uuid", "team_role": "employee"}, ...] }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id):
        user = request.user

        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role == "admin":
            # Admin: must be the creator or a member to manage
            is_creator = team.created_by_id == user.id
            is_member = TeamMember.objects.filter(team=team, user=user).exists()
            if not (is_creator or is_member):
                return Response(
                    {"error": "Team not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            # Others: must be a member with dept_head team role
            if not TeamMember.objects.filter(
                team=team, user=user, team_role="dept_head"
            ).exists():
                return Response(
                    {"error": "You don't have permission to manage members."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = BulkAddTeamMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        added_memberships = []
        skipped = []

        for entry in serializer.validated_data["members"]:
            try:
                target_user = User.objects.get(
                    id=entry["user_id"],
                    company=user.company,
                    is_active=True,
                )
            except User.DoesNotExist:
                skipped.append(f"User {entry['user_id']} not found.")
                continue

            if TeamMember.objects.filter(team=team, user=target_user).exists():
                skipped.append(f"{target_user.full_name} is already in this team.")
                continue

            membership = TeamMember.objects.create(
                team=team,
                user=target_user,
                team_role=entry["team_role"],
                added_by=user,
            )

            log_action(
                action=AuditLog.Action.MEMBER_ADDED,
                user=user,
                company=user.company,
                target_type="team_member",
                target_id=membership.id,
                metadata={
                    "team_name": team.name,
                    "team_id": str(team.id),
                    "member_name": target_user.full_name,
                    "team_role": entry["team_role"],
                },
                request=request,
            )

            added_memberships.append(membership)

        if not added_memberships and skipped:
            return Response(
                {"error": skipped[0], "skipped": skipped},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            "added": TeamMemberSerializer(added_memberships, many=True).data,
            "skipped": skipped,
            "message": f"{len(added_memberships)} member(s) added to {team.name}.",
        }, status=status.HTTP_201_CREATED)


class TeamMemberInviteView(APIView):
    """
    POST /api/teams/{id}/members/invite/
    
    Create a NEW user + add them to this team in one step.
    Generates temp password, returns credentials.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id):
        user = request.user

        # Must be Admin or Dept Head of this team
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only admins can invite (create) new users
        if user.role != "admin":
            return Response(
                {"error": "Only admins can invite new users to the workspace."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = InviteTeamMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        # Check email not taken
        if User.objects.filter(email=data["email"].lower()).exists():
            return Response(
                {"error": "A user with this email already exists."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate temp password
        from .utils import generate_temp_password
        temp_password = generate_temp_password()

        # Create the user
        new_user = User.objects.create_user(
            email=data["email"].lower(),
            password=temp_password,
            full_name=data["full_name"],
            role=data["role"],
            company=user.company,
            contact_number=data.get("contact_number", ""),
            email_secondary=data.get("email_secondary", ""),
            is_password_temp=True,
        )

        # Add to team
        membership = TeamMember.objects.create(
            team=team,
            user=new_user,
            team_role=data["team_role"],
            added_by=user,
        )

        log_action(
            action=AuditLog.Action.USER_INVITED_TO_TEAM,
            user=user,
            company=user.company,
            target_type="user",
            target_id=new_user.id,
            metadata={
                "team_name": team.name,
                "team_id": str(team.id),
                "member_name": new_user.full_name,
                "new_user_name": new_user.full_name,
                "role": data["role"],
                "team_role": data["team_role"],
            },
            request=request,
        )

        return Response({
            "user": UserResponseSerializer(new_user).data,
            "credentials": {
                "username": new_user.email,
                "temporary_password": temp_password,
            },
            "team_membership": TeamMemberSerializer(membership).data,
            "message": f"{new_user.full_name} created and added to {team.name}!",
        }, status=status.HTTP_201_CREATED)


class TeamMemberDetailView(APIView):
    """
    PATCH  /api/teams/{id}/members/{uid}/    → Change team role
    DELETE /api/teams/{id}/members/{uid}/    → Remove from team
    """

    permission_classes = [IsAuthenticated]

    def _get_membership(self, team_id, user_id, requesting_user):
        """Get membership + verify permissions."""
        try:
            team = Team.objects.get(
                id=team_id,
                company=requesting_user.company,
                is_archived=False,
            )
        except Team.DoesNotExist:
            return None, None, "Team not found."

        try:
            membership = TeamMember.objects.select_related("user").get(
                team=team, user_id=user_id
            )
        except TeamMember.DoesNotExist:
            return None, None, "Member not found in this team."

        # Permission check
        if requesting_user.role == "admin":
            return team, membership, None
        elif requesting_user.role == "dept_head":
            if TeamMember.objects.filter(
                team=team, user=requesting_user, team_role="dept_head"
            ).exists():
                return team, membership, None

        return None, None, "You don't have permission."

    def patch(self, request, team_id, user_id):
        user = request.user
        team, membership, error = self._get_membership(team_id, user_id, user)

        if error:
            return Response(
                {"error": error},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ChangeTeamRoleSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_role = membership.team_role
        membership.team_role = serializer.validated_data["team_role"]
        membership.save(update_fields=["team_role"])

        log_action(
            action=AuditLog.Action.MEMBER_ROLE_CHANGED,
            user=user,
            company=user.company,
            target_type="team_member",
            target_id=membership.id,
            metadata={
                "team_name": team.name,
                "team_id": str(team.id),
                "member_name": membership.user.full_name,
                "old_role": old_role,
                "new_role": membership.team_role,
            },
            request=request,
        )

        return Response({
            "member": TeamMemberSerializer(membership).data,
            "message": f"Role updated to {membership.get_team_role_display()}.",
        })

    def delete(self, request, team_id, user_id):
        user = request.user
        team, membership, error = self._get_membership(team_id, user_id, user)

        if error:
            return Response(
                {"error": error},
                status=status.HTTP_404_NOT_FOUND,
            )

        member_name = membership.user.full_name
        membership.delete()

        log_action(
            action=AuditLog.Action.MEMBER_REMOVED,
            user=user,
            company=user.company,
            target_type="team",
            target_id=team.id,
            metadata={
                "team_name": team.name,
                "team_id": str(team.id),
                "member_name": member_name,
                "removed_user": member_name,
            },
            request=request,
        )

        return Response({
            "message": f"{member_name} removed from {team.name}.",
        })


class CompanyMembersView(APIView):
    """
    GET /api/company/members/
    
    List all users in the requesting user's company.
    Admin only — used when adding existing users to teams.
    
    Query params:
        ?search=alice          → filter by name or email
        ?exclude_team=uuid     → exclude users already in this team
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        # Admins and dept_heads can list company members (for adding to teams)
        if user.role not in ("admin", "dept_head"):
            return Response(
                {"error": "You don't have permission to view company members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        queryset = User.objects.filter(
            company=user.company,
            is_active=True,
        ).exclude(role__in=["super_admin", "admin"])

        # Search filter
        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                models.Q(full_name__icontains=search) |
                models.Q(email__icontains=search)
            )

        # Exclude users already in a specific team
        exclude_team = request.query_params.get("exclude_team")
        if exclude_team:
            existing_member_ids = TeamMember.objects.filter(
                team_id=exclude_team
            ).values_list("user_id", flat=True)
            queryset = queryset.exclude(id__in=existing_member_ids)

        users = queryset.order_by("full_name")
        serializer = UserResponseSerializer(users, many=True)

        return Response({
            "members": serializer.data,
            "count": users.count(),
        })

    def post(self, request):
        """
        POST /api/company/members/

        Admin creates a new dept_head or employee in their company.
        Returns user data + one-time temporary credentials.
        """
        if request.user.role != "admin":
            return Response(
                {"error": "Only admins can create new company members."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CreateCompanyMemberSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        temp_password = generate_temp_password()

        new_user = User.objects.create_user(
            email=serializer.validated_data["email"],
            password=temp_password,
            full_name=serializer.validated_data["full_name"],
            contact_number=serializer.validated_data.get("contact_number", ""),
            role=serializer.validated_data["role"],
            email_secondary=serializer.validated_data.get("email_secondary"),
            company=request.user.company,
            created_by=request.user,
            is_password_temp=True,
            is_onboarded=False,
        )

        log_action(
            action=AuditLog.Action.USER_CREATED,
            user=request.user,
            company=request.user.company,
            target_type="user",
            target_id=new_user.id,
            metadata={
                "created_user_email": new_user.email,
                "created_user_role": new_user.role,
            },
            request=request,
        )

        return Response(
            {
                "user": UserListSerializer(new_user).data,
                "credentials": {
                    "username": new_user.email,
                    "temporary_password": temp_password,
                },
                "message": (
                    "Member created successfully. "
                    "Share the credentials securely — the password is shown only once."
                ),
            },
            status=status.HTTP_201_CREATED,
        )
    
class ActivityFeedView(APIView):
    """
    GET /api/activity/feed/

    Returns activity entries scoped to the user's role:
    - Admin: ALL activity across all company teams
    - Dept Head: Activity for teams they manage as dept_head
    - Employee: Activity for teams they belong to

    Query params:
        ?limit=20          → number of items (default 20, max 100)
        ?team_id=uuid      → filter to specific team (optional)
        ?before=ISO-date   → pagination cursor (load older items)

    Each entry includes "date_group": "today" | "yesterday" | "this_week" | "older"
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        limit = min(int(request.query_params.get("limit", 20)), 100)
        team_id = request.query_params.get("team_id")
        before = request.query_params.get("before")

        # Base query: company-scoped
        queryset = AuditLog.objects.filter(
            company=user.company,
        ).select_related("user").order_by("-created_at")

        # Role-based scoping
        if user.role == "admin":
            pass  # Admin sees everything in their company
        elif user.role == "dept_head":
            managed_team_ids = list(TeamMember.objects.filter(
                user=user, team_role="dept_head",
                team__is_archived=False,
            ).values_list("team_id", flat=True))
            queryset = queryset.filter(
                models.Q(metadata__team_id__in=[str(t) for t in managed_team_ids])
                | models.Q(target_type__in=["team", "team_member"])
            )
        else:
            member_team_ids = list(TeamMember.objects.filter(
                user=user,
                team__is_archived=False,
            ).values_list("team_id", flat=True))
            queryset = queryset.filter(
                metadata__team_id__in=[str(t) for t in member_team_ids]
            )

        # Optional team filter
        if team_id:
            queryset = queryset.filter(metadata__team_id=str(team_id))

        # Cursor pagination
        if before:
            from django.utils.dateparse import parse_datetime
            before_dt = parse_datetime(before)
            if before_dt:
                queryset = queryset.filter(created_at__lt=before_dt)

        total_count = queryset.count()
        entries = queryset[:limit]

        # Build response with date grouping
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = today_start - timedelta(days=7)

        data = []
        for entry in entries:
            if entry.created_at >= today_start:
                date_group = "today"
            elif entry.created_at >= yesterday_start:
                date_group = "yesterday"
            elif entry.created_at >= week_start:
                date_group = "this_week"
            else:
                date_group = "older"

            activity_text = self._build_activity_text(entry)

            data.append({
                "id": str(entry.id),
                "action": entry.action,
                "action_display": entry.get_action_display(),
                "activity_text": activity_text,
                "user_name": entry.user.full_name if entry.user else "System",
                "user_avatar": entry.user.avatar_url if entry.user else None,
                "user_id": str(entry.user.id) if entry.user else None,
                "target_type": entry.target_type,
                "metadata": entry.metadata or {},
                "date_group": date_group,
                "created_at": entry.created_at.isoformat(),
            })

        has_more = total_count > limit

        return Response({
            "activities": data,
            "has_more": has_more,
            "next_cursor": data[-1]["created_at"] if data else None,
        })

    def _build_activity_text(self, entry):
        """Build a human-readable activity string from an AuditLog entry."""
        user_name = entry.user.full_name if entry.user else "System"
        meta = entry.metadata or {}
        action = entry.action

        text_map = {
            "team_created": f'{user_name} created team "{meta.get("team_name", "")}"',
            "team_updated": f'{user_name} updated team "{meta.get("team_name", "")}"',
            "team_archived": f'{user_name} archived team "{meta.get("team_name", "")}"',
            "member_added": f'{meta.get("member_name", "Someone")} was added to {meta.get("team_name", "a team")}',
            "member_removed": f'{meta.get("member_name", "Someone")} was removed from {meta.get("team_name", "a team")}',
            "member_role_changed": f'{meta.get("member_name", "Someone")}\'s role changed in {meta.get("team_name", "")}',
            "user_invited_to_team": f'{user_name} invited {meta.get("member_name", "someone")} to {meta.get("team_name", "")}',
            "task_created": f'{user_name} created "{meta.get("title", "a task")}" in {meta.get("team_name", "")}',
            "task_updated": f'{user_name} updated "{meta.get("title", "a task")}"',
            "task_moved": f'{user_name} moved "{meta.get("title", "a task")}" from {meta.get("from_column", "")} → {meta.get("to_column", "")}',
            "task_deleted": f'{user_name} deleted "{meta.get("title", "a task")}"',
            "task_assigned": f'{user_name} assigned {meta.get("assigned_user", "someone")} to "{meta.get("title", "a task")}"',
            "task_unassigned": f'{user_name} removed {meta.get("removed_user", "someone")} from "{meta.get("title", "a task")}"',
            "comment_added": f'{user_name} commented on "{meta.get("task_title", "a task")}"',
        }

        return text_map.get(action, f"{user_name} performed {entry.get_action_display()}")
    

class BoardView(APIView):
    """
    GET /api/teams/{team_id}/board/
    
    Returns the full Kanban board: all columns with their tasks.
    Tasks include assignees, sorted by position within each column.
    
    This is the single API call that renders the entire board.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, team_id):
        user = request.user

        # Verify access
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role != "admin":
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return Response(
                    {"error": "You don't have access to this team."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Get user's last viewed timestamp for this team (for unread indicators)
        last_viewed_at = None
        try:
            view_record = UserTeamView.objects.get(user=user, team=team)
            last_viewed_at = view_record.last_viewed_at
        except UserTeamView.DoesNotExist:
            pass

        # Get columns with tasks — real comment counts in Phase 4
        columns = BoardColumn.objects.filter(team=team).prefetch_related(
            models.Prefetch(
                "tasks",
                queryset=Task.objects.prefetch_related(
                    "assignees__user", "created_by"
                ).annotate(
                    comment_count=models.Count("comments")
                ).order_by("position"),
            )
        ).annotate(
            task_count=models.Count("tasks")
        ).order_by("position")

        serializer = BoardColumnSerializer(columns, many=True)
        columns_data = serializer.data

        # Add is_unread flag to each task
        from django.utils.dateparse import parse_datetime
        for col in columns_data:
            for task_data in col["tasks"]:
                if last_viewed_at:
                    task_updated = task_data.get("updated_at")
                    if task_updated:
                        updated_dt = parse_datetime(task_updated)
                        task_data["is_unread"] = (updated_dt > last_viewed_at) if updated_dt else False
                    else:
                        task_data["is_unread"] = False
                else:
                    task_data["is_unread"] = True  # Never viewed → all unread

        return Response({
            "team_id": str(team.id),
            "team_name": team.name,
            "team_icon": team.icon,
            "team_color": team.color,
            "columns": columns_data,
            "last_viewed_at": last_viewed_at.isoformat() if last_viewed_at else None,
        })


class BoardColumnsView(APIView):
    """
    PATCH /api/teams/{team_id}/board/columns/
    
    Reorder or rename board columns.
    Admin or Dept Head of team can do this.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, team_id):
        user = request.user

        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Permission: Admin or Dept Head of team
        if user.role == "admin":
            pass
        elif user.role == "dept_head":
            if not TeamMember.objects.filter(
                team=team, user=user, team_role="dept_head"
            ).exists():
                return Response(
                    {"error": "You don't have permission."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {"error": "You don't have permission."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ReorderColumnsSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        for col_data in serializer.validated_data["columns"]:
            try:
                column = BoardColumn.objects.get(
                    id=col_data["id"], team=team
                )
                if "name" in col_data:
                    column.name = col_data["name"]
                if "position" in col_data:
                    column.position = col_data["position"]
                column.save()
            except BoardColumn.DoesNotExist:
                continue

        return Response({"message": "Columns updated."})


class TaskListCreateView(APIView):
    """
    GET  /api/teams/{team_id}/tasks/     → List tasks (with filters)
    POST /api/teams/{team_id}/tasks/     → Create a new task
    
    Query params for GET:
        ?priority=critical,high     → filter by priority
        ?assignee=uuid              → filter by assignee
        ?column=uuid                → filter by column
        ?search=fix bug             → search title
        ?sort=due_date              → sort by field (default: position)
        ?page=1&page_size=50        → pagination
    """

    permission_classes = [IsAuthenticated]

    def _get_team(self, team_id, user):
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return None

        if user.role != "admin":
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return None
        return team

    def get(self, request, team_id):
        team = self._get_team(team_id, request.user)
        if not team:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        queryset = Task.objects.filter(team=team).prefetch_related(
            "assignees__user", "created_by"
        ).annotate(
            comment_count=models.Value(0, output_field=models.IntegerField())
        )

        # Filters
        priority = request.query_params.get("priority")
        if priority:
            priorities = priority.split(",")
            queryset = queryset.filter(priority__in=priorities)

        assignee = request.query_params.get("assignee")
        if assignee:
            queryset = queryset.filter(assignees__user_id=assignee)

        column = request.query_params.get("column")
        if column:
            queryset = queryset.filter(column_id=column)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(title__icontains=search)

        # Sort
        sort = request.query_params.get("sort", "position")
        sort_map = {
            "position": "position",
            "due_date": "due_date",
            "priority": "priority",
            "created_at": "-created_at",
            "title": "title",
        }
        queryset = queryset.order_by(sort_map.get(sort, "position"))

        # Pagination
        page = int(request.query_params.get("page", 1))
        page_size = min(int(request.query_params.get("page_size", 50)), 100)
        start = (page - 1) * page_size
        end = start + page_size

        total = queryset.count()
        tasks = queryset[start:end]

        serializer = TaskCardSerializer(tasks, many=True)

        return Response({
            "tasks": serializer.data,
            "total": total,
            "page": page,
            "page_size": page_size,
        })

    def post(self, request, team_id):
        user = request.user
        team = self._get_team(team_id, user)
        if not team:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CreateTaskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        # Determine column
        if data.get("column_id"):
            try:
                column = BoardColumn.objects.get(id=data["column_id"], team=team)
            except BoardColumn.DoesNotExist:
                return Response(
                    {"error": "Column not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            # Default to first column (Not Started)
            column = BoardColumn.objects.filter(team=team).order_by("position").first()
            if not column:
                return Response(
                    {"error": "No columns found. Please contact admin."},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

        # Calculate position (add to bottom of column)
        last_task = Task.objects.filter(column=column).order_by("-position").first()
        position = (last_task.position + 1.0) if last_task else 1.0

        task = Task.objects.create(
            team=team,
            column=column,
            title=data["title"],
            description=data.get("description", ""),
            priority=data.get("priority", "medium"),
            position=position,
            due_date=data.get("due_date"),
            created_by=user,
        )

        # Add assignees
        assignee_ids = data.get("assignee_ids", [])
        for uid in assignee_ids:
            try:
                assignee_user = User.objects.get(
                    id=uid, company=user.company, is_active=True
                )
                TaskAssignee.objects.create(
                    task=task,
                    user=assignee_user,
                    assigned_by=user,
                )
            except User.DoesNotExist:
                continue

        log_action(
            action=AuditLog.Action.TASK_CREATED,
            user=user,
            company=user.company,
            target_type="task",
            target_id=task.id,
            metadata={
                "title": task.title,
                "team_name": team.name,
                "team_id": str(team.id),
                "priority": task.priority,
                "assignees": [str(uid) for uid in assignee_ids],
            },
            request=request,
        )

        # Re-fetch with relations
        task = Task.objects.prefetch_related(
            "assignees__user", "created_by"
        ).annotate(
            comment_count=models.Value(0, output_field=models.IntegerField())
        ).get(id=task.id)

        return Response({
            "task": TaskCardSerializer(task).data,
            "message": "Task created!",
        }, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):
    """
    GET    /api/teams/{team_id}/tasks/{task_id}/    → Full task detail
    PATCH  /api/teams/{team_id}/tasks/{task_id}/    → Update task
    DELETE /api/teams/{team_id}/tasks/{task_id}/    → Delete task (Admin/DeptHead)
    """

    permission_classes = [IsAuthenticated]

    def _get_task(self, team_id, task_id, user):
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return None, None

        if user.role != "admin":
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return None, None

        try:
            task = Task.objects.prefetch_related(
                "assignees__user", "created_by"
            ).annotate(
                comment_count=models.Value(0, output_field=models.IntegerField())
            ).get(id=task_id, team=team)
        except Task.DoesNotExist:
            return team, None

        return team, task

    def get(self, request, team_id, task_id):
        team, task = self._get_task(team_id, task_id, request.user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response({"task": TaskDetailSerializer(task).data})

    def patch(self, request, team_id, task_id):
        user = request.user
        team, task = self._get_task(team_id, task_id, user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = UpdateTaskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        update_fields = ["updated_at"]

        for field in ["title", "description", "priority", "due_date"]:
            if field in data:
                setattr(task, field, data[field])
                update_fields.append(field)

        task.save(update_fields=update_fields)

        log_action(
            action=AuditLog.Action.TASK_UPDATED,
            user=user,
            company=user.company,
            target_type="task",
            target_id=task.id,
            metadata={"updated_fields": update_fields, "title": task.title, "team_id": str(team.id), "team_name": team.name},
            request=request,
        )

        # System comment for priority changes
        if "priority" in data:
            create_system_comment(
                task,
                f"{user.full_name} changed priority to {data['priority'].title()}"
            )

        # Re-fetch
        team, task = self._get_task(team_id, task_id, user)
        return Response({
            "task": TaskDetailSerializer(task).data,
            "message": "Task updated!",
        })

    def delete(self, request, team_id, task_id):
        user = request.user
        team, task = self._get_task(team_id, task_id, user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Only Admin or Dept Head can delete tasks
        if user.role == "admin":
            pass
        elif user.role == "dept_head":
            if not TeamMember.objects.filter(
                team=team, user=user, team_role="dept_head"
            ).exists():
                return Response(
                    {"error": "Only admins and department heads can delete tasks."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        else:
            return Response(
                {"error": "Only admins and department heads can delete tasks."},
                status=status.HTTP_403_FORBIDDEN,
            )

        task_title = task.title
        task.delete()

        log_action(
            action=AuditLog.Action.TASK_DELETED,
            user=user,
            company=user.company,
            target_type="task",
            target_id=task_id,
            metadata={"title": task_title, "team_name": team.name, "team_id": str(team.id)},
            request=request,
        )

        return Response({"message": f"Task '{task_title}' deleted."})


class TaskMoveView(APIView):
    """
    POST /api/teams/{team_id}/tasks/{task_id}/move/
    
    Move a task to a different column and/or reorder within a column.
    This is the drag-and-drop endpoint.
    
    The frontend sends the target column_id and the new position (float).
    Position is calculated client-side as the midpoint between adjacent tasks.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id, task_id):
        user = request.user

        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role != "admin":
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return Response(
                    {"error": "Access denied."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        try:
            task = Task.objects.get(id=task_id, team=team)
        except Task.DoesNotExist:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = MoveTaskSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data

        try:
            target_column = BoardColumn.objects.get(
                id=data["column_id"], team=team
            )
        except BoardColumn.DoesNotExist:
            return Response(
                {"error": "Target column not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        old_column_name = task.column.name
        task.column = target_column
        task.position = data["position"]
        task.save(update_fields=["column", "position", "updated_at"])

        if old_column_name != target_column.name:
            log_action(
                action=AuditLog.Action.TASK_MOVED,
                user=user,
                company=user.company,
                target_type="task",
                target_id=task.id,
                metadata={
                    "title": task.title,
                    "team_name": team.name,
                    "team_id": str(team.id),
                    "from_column": old_column_name,
                    "to_column": target_column.name,
                },
                request=request,
            )
            create_system_comment(
                task,
                f"{user.full_name} changed status: {old_column_name} → {target_column.name}"
            )

        return Response({
            "message": f"Task moved to {target_column.name}.",
            "task_id": str(task.id),
            "column_id": str(target_column.id),
            "position": task.position,
        })


class TaskAssigneeView(APIView):
    """
    POST   /api/teams/{team_id}/tasks/{task_id}/assignees/          → Add assignee
    DELETE /api/teams/{team_id}/tasks/{task_id}/assignees/{user_id}/ → Remove assignee
    """

    permission_classes = [IsAuthenticated]

    def _get_task(self, team_id, task_id, user):
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
            task = Task.objects.get(id=task_id, team=team)
        except (Team.DoesNotExist, Task.DoesNotExist):
            return None, None
        return team, task

    def post(self, request, team_id, task_id):
        user = request.user
        team, task = self._get_task(team_id, task_id, user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_id = request.data.get("user_id")
        if not user_id:
            return Response(
                {"error": "user_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_user = User.objects.get(
                id=user_id, company=user.company, is_active=True
            )
        except User.DoesNotExist:
            return Response(
                {"error": "User not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if TaskAssignee.objects.filter(task=task, user=target_user).exists():
            return Response(
                {"error": f"{target_user.full_name} is already assigned."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assignment = TaskAssignee.objects.create(
            task=task,
            user=target_user,
            assigned_by=user,
        )

        log_action(
            action=AuditLog.Action.TASK_ASSIGNED,
            user=user,
            company=user.company,
            target_type="task",
            target_id=task.id,
            metadata={
                "title": task.title,
                "team_name": team.name,
                "team_id": str(team.id),
                "assigned_user": target_user.full_name,
            },
            request=request,
        )
        create_system_comment(
            task,
            f"{user.full_name} assigned {target_user.full_name} to this task"
        )

        return Response({
            "assignee": TaskAssigneeSerializer(assignment).data,
            "message": f"{target_user.full_name} assigned to task.",
        }, status=status.HTTP_201_CREATED)

    def delete(self, request, team_id, task_id, user_id=None):
        user = request.user
        team, task = self._get_task(team_id, task_id, user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            assignment = TaskAssignee.objects.select_related("user").get(
                task=task, user_id=user_id
            )
        except TaskAssignee.DoesNotExist:
            return Response(
                {"error": "Assignee not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        removed_name = assignment.user.full_name
        assignment.delete()

        log_action(
            action=AuditLog.Action.TASK_UNASSIGNED,
            user=user,
            company=user.company,
            target_type="task",
            target_id=task.id,
            metadata={
                "title": task.title,
                "team_name": team.name,
                "team_id": str(team.id),
                "removed_user": removed_name,
            },
            request=request,
        )
        create_system_comment(
            task,
            f"{user.full_name} removed {removed_name} from this task"
        )

        return Response({
            "message": f"{removed_name} removed from task.",
        })


# ══════════════════════════════════════════════════════
#  BULK TASK ACTION VIEW (Phase 3 Patch / Step 0A)
# ══════════════════════════════════════════════════════

class BulkTaskActionView(APIView):
    """
    POST /api/teams/{team_id}/tasks/bulk/

    Perform bulk operations on multiple tasks at once.
    Used by List View row-selection actions.

    Body:
    {
        "task_ids": ["uuid1", "uuid2"],
        "action": "change_status",
        "value": "<column-uuid>"
    }

    Actions:
        change_status   → moves all tasks to the specified column
        change_priority → sets priority on all tasks
        assign          → adds assignee to all tasks
        unassign        → removes assignee from all tasks
        delete          → deletes all tasks (Admin/DeptHead only)
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id):
        user = request.user

        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user.role != "admin":
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return Response(
                    {"error": "Access denied."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        serializer = BulkTaskActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = serializer.validated_data
        task_ids = data["task_ids"]
        action = data["action"]
        value = data.get("value", "")

        tasks = Task.objects.filter(id__in=task_ids, team=team)
        count = tasks.count()

        if count == 0:
            return Response(
                {"error": "No matching tasks found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if action == "change_status":
            try:
                column = BoardColumn.objects.get(id=value, team=team)
            except BoardColumn.DoesNotExist:
                return Response(
                    {"error": "Column not found."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tasks.update(column=column)
            msg = f"{count} task(s) moved to {column.name}."

        elif action == "change_priority":
            if value not in ["critical", "high", "medium", "low"]:
                return Response(
                    {"error": "Invalid priority."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tasks.update(priority=value)
            msg = f"{count} task(s) set to {value} priority."

        elif action == "assign":
            try:
                target_user = User.objects.get(
                    id=value, company=user.company, is_active=True
                )
            except User.DoesNotExist:
                return Response(
                    {"error": "User not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            for task in tasks:
                TaskAssignee.objects.get_or_create(
                    task=task, user=target_user,
                    defaults={"assigned_by": user},
                )
            msg = f"{target_user.full_name} assigned to {count} task(s)."

        elif action == "unassign":
            TaskAssignee.objects.filter(task__in=tasks, user_id=value).delete()
            msg = f"User removed from {count} task(s)."

        elif action == "delete":
            if user.role == "admin":
                pass
            elif user.role == "dept_head":
                if not TeamMember.objects.filter(
                    team=team, user=user, team_role="dept_head"
                ).exists():
                    return Response(
                        {"error": "Only admins and dept heads can delete tasks."},
                        status=status.HTTP_403_FORBIDDEN,
                    )
            else:
                return Response(
                    {"error": "Only admins and dept heads can delete tasks."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            tasks.delete()
            msg = f"{count} task(s) deleted."

        else:
            return Response(
                {"error": f"Unknown action: {action}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        log_action(
            action=AuditLog.Action.TASK_UPDATED,
            user=user,
            company=user.company,
            target_type="task_bulk",
            metadata={
                "bulk_action": action,
                "task_count": count,
                "team_name": team.name,
                "team_id": str(team.id),
            },
            request=request,
        )

        return Response({"message": msg, "affected_count": count})


# ══════════════════════════════════════════════════════
#  COMMENT VIEWS (Phase 4 / Step 3)
# ══════════════════════════════════════════════════════

class CommentListCreateView(APIView):
    """
    GET  /api/teams/{team_id}/tasks/{task_id}/comments/  → List all comments
    POST /api/teams/{team_id}/tasks/{task_id}/comments/  → Add a user comment

    System comments are NOT created here — they are auto-generated inside
    TaskMoveView, TaskDetailView, and TaskAssigneeView when task events occur.
    """

    permission_classes = [IsAuthenticated]

    def _get_task(self, team_id, task_id, user):
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return None, None

        if user.role != "admin":
            if not TeamMember.objects.filter(team=team, user=user).exists():
                return None, None

        try:
            task = Task.objects.get(id=task_id, team=team)
        except Task.DoesNotExist:
            return team, None

        return team, task

    def get(self, request, team_id, task_id):
        team, task = self._get_task(team_id, task_id, request.user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        comments = Comment.objects.filter(
            task=task,
        ).select_related("user").order_by("created_at")

        serializer = CommentSerializer(comments, many=True)
        data = serializer.data

        # Mask deleted comment content
        for item in data:
            if item["is_deleted"]:
                item["content"] = "[This comment was deleted]"

        return Response({
            "comments": data,
            "total": len(data),
        })

    def post(self, request, team_id, task_id):
        user = request.user
        team, task = self._get_task(team_id, task_id, user)
        if not task:
            return Response(
                {"error": "Task not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = CreateCommentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = Comment.objects.create(
            task=task,
            user=user,
            content=serializer.validated_data["content"],
            is_system=False,
        )

        # Touch task.updated_at to trigger unread indicators for other users
        task.save(update_fields=["updated_at"])

        log_action(
            action=AuditLog.Action.COMMENT_ADDED,
            user=user,
            company=user.company,
            target_type="comment",
            target_id=comment.id,
            metadata={
                "task_title": task.title,
                "task_id": str(task.id),
                "team_name": team.name,
                "team_id": str(team.id),
                "comment_preview": comment.content[:100],
            },
            request=request,
        )

        return Response({
            "comment": CommentSerializer(comment).data,
            "message": "Comment added.",
        }, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    """
    PATCH  /api/teams/{tid}/tasks/{taskId}/comments/{cid}/  → Edit comment
    DELETE /api/teams/{tid}/tasks/{taskId}/comments/{cid}/  → Soft-delete comment

    Edit rules:
    - Only the comment author can edit
    - Only within 24 hours of creation
    - System comments cannot be edited

    Delete rules:
    - Author can delete own comments anytime
    - Admin and dept_head of the team can delete any comment
    - Soft delete (sets deleted_at, keeps record)
    """

    permission_classes = [IsAuthenticated]

    def _get_comment(self, team_id, task_id, comment_id, user):
        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
            task = Task.objects.get(id=task_id, team=team)
            comment = Comment.objects.select_related("user").get(
                id=comment_id, task=task
            )
        except (Team.DoesNotExist, Task.DoesNotExist, Comment.DoesNotExist):
            return None, None, None
        return team, task, comment

    def patch(self, request, team_id, task_id, comment_id):
        user = request.user
        team, task, comment = self._get_comment(team_id, task_id, comment_id, user)
        if not comment:
            return Response(
                {"error": "Comment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if comment.user_id != user.id:
            return Response(
                {"error": "You can only edit your own comments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if comment.is_system:
            return Response(
                {"error": "System comments cannot be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if comment.is_deleted:
            return Response(
                {"error": "This comment has been deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 24-hour edit window
        age = timezone.now() - comment.created_at
        if age > timedelta(hours=24):
            return Response(
                {"error": "Comments can only be edited within 24 hours of posting."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = EditCommentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment.content = serializer.validated_data["content"]
        comment.edited_at = timezone.now()
        comment.save(update_fields=["content", "edited_at"])

        return Response({
            "comment": CommentSerializer(comment).data,
            "message": "Comment updated.",
        })

    def delete(self, request, team_id, task_id, comment_id):
        user = request.user
        team, task, comment = self._get_comment(team_id, task_id, comment_id, user)
        if not comment:
            return Response(
                {"error": "Comment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if comment.is_system:
            return Response(
                {"error": "System comments cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if comment.is_deleted:
            return Response(
                {"error": "Comment already deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Permission: author, admin, or dept_head of this team
        can_delete = False
        if comment.user_id == user.id:
            can_delete = True
        elif user.role == "admin":
            can_delete = True
        elif user.role == "dept_head":
            can_delete = TeamMember.objects.filter(
                team=team, user=user, team_role="dept_head"
            ).exists()

        if not can_delete:
            return Response(
                {"error": "You don't have permission to delete this comment."},
                status=status.HTTP_403_FORBIDDEN,
            )

        comment.deleted_at = timezone.now()
        comment.save(update_fields=["deleted_at"])

        return Response({"message": "Comment deleted."})


# ══════════════════════════════════════════════════════
#  UNREAD TRACKING VIEWS (Phase 4 / Step 5)
# ══════════════════════════════════════════════════════

class MarkTeamViewedView(APIView):
    """
    POST /api/teams/{team_id}/viewed/

    Called when a user opens a team's board page.
    Updates their last_viewed_at timestamp for this team.
    All tasks updated before this timestamp are considered "read".
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, team_id):
        user = request.user

        try:
            team = Team.objects.get(
                id=team_id, company=user.company, is_archived=False
            )
        except Team.DoesNotExist:
            return Response(
                {"error": "Team not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        view_record, created = UserTeamView.objects.update_or_create(
            user=user,
            team=team,
            defaults={"last_viewed_at": timezone.now()},
        )

        return Response({
            "last_viewed_at": view_record.last_viewed_at.isoformat(),
        })


class UnreadCountsView(APIView):
    """
    GET /api/teams/unread-counts/

    Returns unread task counts for all of the current user's teams.
    Used on the home page to show "X new changes" badges on team cards.

    Response:
    {
        "teams": {
            "team-uuid-1": { "unread_count": 5, "last_viewed_at": "..." },
            "team-uuid-2": { "unread_count": 0, "last_viewed_at": null }
        }
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if user.role == "admin":
            teams = Team.objects.filter(
                company=user.company, is_archived=False
            )
        else:
            member_team_ids = TeamMember.objects.filter(
                user=user, team__is_archived=False
            ).values_list("team_id", flat=True)
            teams = Team.objects.filter(id__in=member_team_ids)

        view_records = {
            str(v.team_id): v.last_viewed_at
            for v in UserTeamView.objects.filter(user=user, team__in=teams)
        }

        result = {}
        for team in teams:
            team_id_str = str(team.id)
            last_viewed = view_records.get(team_id_str)

            if last_viewed:
                unread_count = Task.objects.filter(
                    team=team,
                    updated_at__gt=last_viewed,
                ).count()
            else:
                unread_count = Task.objects.filter(team=team).count()

            result[team_id_str] = {
                "unread_count": unread_count,
                "last_viewed_at": last_viewed.isoformat() if last_viewed else None,
            }

        return Response({"teams": result})