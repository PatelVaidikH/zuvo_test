"""
Zuvo — Serializers (Phase 1)
==============================
Serializers validate incoming API data and format outgoing responses.
"""

from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from .models import (
    Company, User, PasswordReset, AuditLog,
    Team, TeamMember, BoardColumn, Task, TaskAssignee,
    Comment, UserTeamView,
)


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
            "last_login",
            "created_at",
        ]
        # These fields are READ-ONLY — can't be changed through this serializer
        read_only_fields = fields

    def get_company_name(self, obj):
        """Get the company name for display (instead of just the UUID)."""
        return obj.company.name if obj.company else None
    
# ──────────────────────────────────────────────
# 4. COMPANY SERIALIZERS (Super Admin)
# ──────────────────────────────────────────────

class CompanyListSerializer(serializers.ModelSerializer):
    """
    For listing companies in the Super Admin dashboard table.
    Includes computed fields like user_count and team_count.
    """

    user_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "description",
            "logo_url",
            "is_active",
            "user_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "is_active", "created_at", "updated_at"]

    def get_user_count(self, obj):
        """Count active users in this company."""
        return obj.users.filter(is_active=True).count()


class CompanyCreateSerializer(serializers.ModelSerializer):
    """
    Validates data when creating a new company.
    Input: { "name": "Acme Corp", "description": "Manufacturing firm" }
    """

    class Meta:
        model = Company
        fields = ["name", "description"]

    def validate_name(self, value):
        """Company name must be unique."""
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Company name is required.")
        if Company.objects.filter(name__iexact=value).exists():
            raise serializers.ValidationError(
                f"A company named '{value}' already exists."
            )
        return value


class CompanyDetailSerializer(serializers.ModelSerializer):
    """
    Detailed view of a company (when Super Admin clicks 👁).
    Includes stats.
    """

    user_count = serializers.SerializerMethodField()
    admin_count = serializers.SerializerMethodField()

    class Meta:
        model = Company
        fields = [
            "id",
            "name",
            "description",
            "logo_url",
            "is_active",
            "user_count",
            "admin_count",
            "created_at",
            "updated_at",
        ]

    def get_user_count(self, obj):
        return obj.users.filter(is_active=True).count()

    def get_admin_count(self, obj):
        return obj.users.filter(is_active=True, role="admin").count()


class CompanyUpdateSerializer(serializers.ModelSerializer):
    """
    Validates data when editing a company.
    Only name and description can be changed.
    """

    class Meta:
        model = Company
        fields = ["name", "description"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Company name is required.")
        # Allow same name if it's the SAME company being edited
        existing = Company.objects.filter(name__iexact=value).exclude(
            id=self.instance.id
        )
        if existing.exists():
            raise serializers.ValidationError(
                f"A company named '{value}' already exists."
            )
        return value


# ──────────────────────────────────────────────
# 5. USER MANAGEMENT SERIALIZERS (Super Admin)
# ──────────────────────────────────────────────

class CreateUserSerializer(serializers.Serializer):
    """
    Validates data when Super Admin creates a user for a company.
    
    Input: {
        "full_name": "John Miller",
        "email": "john@acme.com",
        "contact_number": "9876543210",
        "role": "admin",
        "email_secondary": "john.personal@gmail.com"
    }
    
    The PASSWORD is NOT in the input — it's auto-generated.
    """

    full_name = serializers.CharField(
        max_length=255,
        required=True,
        help_text="User's full name"
    )
    email = serializers.EmailField(
        required=True,
        help_text="Primary email (login username)"
    )
    contact_number = serializers.CharField(
        max_length=20,
        required=False,
        allow_blank=True,
        default="",
        help_text="Phone number"
    )
    role = serializers.ChoiceField(
        choices=[("admin", "Admin"), ("dept_head", "Department Head")],
        required=True,
        help_text="User's role in the company"
    )
    email_secondary = serializers.EmailField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Optional backup email"
    )

    def validate_email(self, value):
        """Email must be unique across ALL companies."""
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value


class CreateCompanyMemberSerializer(serializers.Serializer):
    """
    For admin creating a new dept_head or employee within the same company.
    Role is restricted to dept_head or employee (no admin / super_admin).
    """

    full_name = serializers.CharField(max_length=255, required=True)
    email = serializers.EmailField(required=True)
    contact_number = serializers.CharField(
        max_length=20, required=False, allow_blank=True, default=""
    )
    role = serializers.ChoiceField(
        choices=[("dept_head", "Department Head"), ("employee", "Employee")],
        required=True,
    )
    email_secondary = serializers.EmailField(
        required=False, allow_blank=True, allow_null=True
    )

    def validate_email(self, value):
        value = value.lower().strip()
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                "A user with this email already exists."
            )
        return value


class UserListSerializer(serializers.ModelSerializer):
    """
    For listing users in the client detail popup.
    """

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "email_secondary",
            "contact_number",
            "role",
            "job_title",
            "avatar_url",
            "is_active",
            "is_password_temp",
            "is_onboarded",
            "last_login",
            "created_at",
        ]


class UserUpdateSerializer(serializers.Serializer):
    """
    Validates data when editing a user.
    Only certain fields can be changed by Super Admin.
    """

    full_name = serializers.CharField(max_length=255, required=False)
    contact_number = serializers.CharField(max_length=20, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[("admin", "Admin"), ("dept_head", "Department Head"), ("employee", "Employee")],
        required=False,
    )
    email_secondary = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    is_active = serializers.BooleanField(required=False)


# ──────────────────────────────────────────────
# 6. ONBOARDING SERIALIZER
# ──────────────────────────────────────────────

class OnboardingSerializer(serializers.Serializer):
    """
    Validates onboarding data (first-time profile setup).
    
    Input: {
        "full_name": "John Miller",
        "job_title": "Marketing Head",
        "timezone": "Asia/Kolkata",
        "avatar_url": null,
        "notification_preferences": {
            "task_assigned": true,
            "mentioned": true,
            "deadline_approaching": true,
            "status_changes": false,
            "new_team_member": false
        }
    }
    """

    full_name = serializers.CharField(max_length=255, required=True)
    job_title = serializers.CharField(max_length=255, required=True)
    timezone = serializers.CharField(max_length=50, required=False, default="UTC")
    avatar_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    notification_preferences = serializers.JSONField(required=False, default=dict)


# ──────────────────────────────────────────────────────
# 7. TEAM SERIALIZERS
# ──────────────────────────────────────────────────────

class TeamMemberSerializer(serializers.ModelSerializer):
    """
    Serializes a team member (the junction record + nested user info).
    
    Output:
    {
        "id": "uuid-of-membership",
        "user": {
            "id": "uuid", "full_name": "Alice", "email": "alice@acme.com",
            "role": "dept_head", "avatar_url": null, "is_active": true
        },
        "team_role": "dept_head",
        "joined_at": "2026-01-15T..."
    }
    """

    user = UserResponseSerializer(read_only=True)

    class Meta:
        model = TeamMember
        fields = ["id", "user", "team_role", "joined_at"]


class TeamListSerializer(serializers.ModelSerializer):
    """
    Compact team info for the home page cards.
    
    Output:
    {
        "id": "uuid",
        "name": "Engineering",
        "description": "Backend & frontend dev",
        "icon": "🔧",
        "color": "#FF6B6B",
        "member_count": 5,
        "created_at": "2026-01-15T..."
    }
    """

    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = [
            "id", "name", "description", "icon", "color",
            "member_count", "is_archived", "created_at",
        ]


class TeamDetailSerializer(serializers.ModelSerializer):
    """
    Full team details including members list.
    
    Output:
    {
        "id": "uuid",
        "name": "Engineering",
        "description": "...",
        "icon": "🔧",
        "color": "#FF6B6B",
        "member_count": 5,
        "members": [ ...TeamMemberSerializer... ],
        "created_by": { ...UserResponseSerializer... },
        "created_at": "...",
        "updated_at": "..."
    }
    """

    members = TeamMemberSerializer(many=True, read_only=True)
    created_by = UserResponseSerializer(read_only=True)
    member_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Team
        fields = [
            "id", "name", "description", "icon", "color",
            "member_count", "members", "created_by",
            "is_archived", "created_at", "updated_at",
        ]


class CreateTeamSerializer(serializers.Serializer):
    """
    Input for creating a new team.
    
    Input:
    {
        "name": "Engineering",
        "description": "Backend & frontend dev team",
        "icon": "🔧",
        "color": "#FF6B6B"
    }
    """

    name = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    icon = serializers.CharField(max_length=10, required=False, default="📁")
    color = serializers.CharField(max_length=7, required=False, default="#FF6B6B")

    def validate_name(self, value):
        company = self.context.get("company")
        if company and Team.objects.filter(
            company=company, name__iexact=value, is_archived=False
        ).exists():
            raise serializers.ValidationError(
                "A team with this name already exists in your company."
            )
        return value


class UpdateTeamSerializer(serializers.Serializer):
    """
    Input for updating team info.
    All fields optional — only send what changed.
    """

    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    icon = serializers.CharField(max_length=10, required=False)
    color = serializers.CharField(max_length=7, required=False)

    def validate_name(self, value):
        company = self.context.get("company")
        team_id = self.context.get("team_id")
        if company and Team.objects.filter(
            company=company, name__iexact=value, is_archived=False
        ).exclude(id=team_id).exists():
            raise serializers.ValidationError(
                "A team with this name already exists in your company."
            )
        return value


class AddTeamMemberSerializer(serializers.Serializer):
    """
    Add an existing company user to this team.
    
    Input:
    {
        "user_id": "uuid-of-existing-user",
        "team_role": "employee"
    }
    """

    user_id = serializers.UUIDField()
    team_role = serializers.ChoiceField(
        choices=TeamMember.TeamRole.choices,
        default=TeamMember.TeamRole.EMPLOYEE,
    )


class BulkAddTeamMemberSerializer(serializers.Serializer):
    """
    Add multiple existing company users to a team in one request.

    Input:
    {
        "members": [
            {"user_id": "uuid", "team_role": "employee"},
            {"user_id": "uuid", "team_role": "dept_head"}
        ]
    }
    """

    class MemberEntrySerializer(serializers.Serializer):
        user_id = serializers.UUIDField()
        team_role = serializers.ChoiceField(
            choices=TeamMember.TeamRole.choices,
            default=TeamMember.TeamRole.EMPLOYEE,
        )

    members = MemberEntrySerializer(many=True, min_length=1)


class InviteTeamMemberSerializer(serializers.Serializer):
    """
    Create a NEW user and add them to this team in one step.
    Same as Super Admin's create user, but scoped to the team's company.
    
    Input:
    {
        "full_name": "Diana Prince",
        "email": "diana@acme.com",
        "contact_number": "9876543210",
        "role": "employee",
        "team_role": "employee",
        "email_secondary": ""
    }
    """

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    contact_number = serializers.CharField(max_length=20, required=False, default="")
    role = serializers.ChoiceField(
        choices=["dept_head", "employee"],
        default="employee",
    )
    team_role = serializers.ChoiceField(
        choices=TeamMember.TeamRole.choices,
        default=TeamMember.TeamRole.EMPLOYEE,
    )
    email_secondary = serializers.EmailField(required=False, allow_blank=True)


class ChangeTeamRoleSerializer(serializers.Serializer):
    """
    Change a member's role within a team.
    
    Input: { "team_role": "dept_head" }
    """

    team_role = serializers.ChoiceField(choices=TeamMember.TeamRole.choices)

# ──────────────────────────────────────────────────────
# 8. BOARD & TASK SERIALIZERS
# ──────────────────────────────────────────────────────

class TaskAssigneeSerializer(serializers.ModelSerializer):
    """Nested assignee info inside a task."""

    user = UserResponseSerializer(read_only=True)

    class Meta:
        model = TaskAssignee
        fields = ["id", "user", "assigned_at"]


class TaskCardSerializer(serializers.ModelSerializer):
    """
    Compact task info for Kanban cards and list rows.
    
    Output:
    {
        "id": "uuid",
        "title": "Fix auth bug",
        "priority": "critical",
        "column_id": "uuid",
        "position": 1.0,
        "due_date": "2026-01-20T17:00:00Z",
        "assignees": [ { "id": "uuid", "user": {...}, "assigned_at": "..." } ],
        "comment_count": 3,
        "created_by": { ... },
        "created_at": "..."
    }
    """

    assignees = TaskAssigneeSerializer(many=True, read_only=True)
    created_by = UserResponseSerializer(read_only=True)
    column_id = serializers.UUIDField(source="column.id", read_only=True)
    comment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "priority", "column_id", "position",
            "due_date", "assignees", "comment_count",
            "created_by", "created_at", "updated_at",
        ]


class TaskDetailSerializer(serializers.ModelSerializer):
    """
    Full task details for the task detail slide-over.
    Includes description and all metadata.
    """

    assignees = TaskAssigneeSerializer(many=True, read_only=True)
    created_by = UserResponseSerializer(read_only=True)
    column_id = serializers.UUIDField(source="column.id", read_only=True)
    column_name = serializers.CharField(source="column.name", read_only=True)
    comment_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Task
        fields = [
            "id", "title", "description", "priority",
            "column_id", "column_name", "position",
            "due_date", "assignees", "comment_count",
            "created_by", "created_at", "updated_at",
        ]


class BoardColumnSerializer(serializers.ModelSerializer):
    """
    A board column with its tasks.
    Used to render the entire Kanban board in one API call.
    """

    tasks = TaskCardSerializer(many=True, read_only=True)
    task_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = BoardColumn
        fields = [
            "id", "name", "position", "color",
            "is_default", "task_count", "tasks",
        ]


class CreateTaskSerializer(serializers.Serializer):
    """
    Input for creating a new task.
    
    Input:
    {
        "title": "Fix authentication bug",
        "description": "The refresh token...",
        "priority": "critical",
        "column_id": "uuid",
        "due_date": "2026-01-20T17:00:00Z",
        "assignee_ids": ["uuid1", "uuid2"]
    }
    """

    title = serializers.CharField(max_length=500)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(
        choices=Task.Priority.choices,
        default=Task.Priority.MEDIUM,
    )
    column_id = serializers.UUIDField(required=False)  # defaults to first column
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    assignee_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )


class UpdateTaskSerializer(serializers.Serializer):
    """
    Input for updating a task. All fields optional.
    """

    title = serializers.CharField(max_length=500, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(
        choices=Task.Priority.choices,
        required=False,
    )
    due_date = serializers.DateTimeField(required=False, allow_null=True)


class MoveTaskSerializer(serializers.Serializer):
    """
    Move a task to a different column and/or position.
    
    Input:
    {
        "column_id": "uuid",
        "position": 1.5
    }
    """

    column_id = serializers.UUIDField()
    position = serializers.FloatField()


class ReorderColumnsSerializer(serializers.Serializer):
    """
    Reorder or rename board columns.

    Input:
    {
        "columns": [
            { "id": "uuid", "name": "To Do", "position": 0 },
            { "id": "uuid", "name": "In Progress", "position": 1 },
            ...
        ]
    }
    """

    columns = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
    )


# ──────────────────────────────────────────────────────
# 9. BULK TASK ACTION SERIALIZER (Phase 3 Patch)
# ──────────────────────────────────────────────────────

class BulkTaskActionSerializer(serializers.Serializer):
    """
    Bulk operations on multiple tasks.

    Input:
    {
        "task_ids": ["uuid1", "uuid2", "uuid3"],
        "action": "change_status",
        "value": "uuid-of-target-column"
    }

    Supported actions:
        change_status   → value = column_id (UUID)
        change_priority → value = "critical" | "high" | "medium" | "low"
        assign          → value = user_id (UUID)
        unassign        → value = user_id (UUID)
        delete          → value = not required
    """

    task_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
        max_length=50,
    )
    action = serializers.ChoiceField(
        choices=["change_status", "change_priority", "assign", "unassign", "delete"],
    )
    value = serializers.CharField(required=False, allow_blank=True, default="")


# ──────────────────────────────────────────────────────
# 10. COMMENT SERIALIZERS (Phase 4)
# ──────────────────────────────────────────────────────

class CommentSerializer(serializers.ModelSerializer):
    """
    Output serializer for a single comment.

    Output:
    {
        "id": "uuid",
        "user": { "id": "...", "full_name": "Alice Johnson", ... },
        "content": "I found the issue...",
        "is_system": false,
        "is_edited": true,
        "is_deleted": false,
        "mentions": ["uuid1", "uuid2"],
        "created_at": "2026-01-18T14:30:00Z",
        "edited_at": "2026-01-18T14:35:00Z"
    }
    """

    user = UserResponseSerializer(read_only=True)
    is_edited = serializers.BooleanField(read_only=True)
    is_deleted = serializers.BooleanField(read_only=True)
    mentions = serializers.SerializerMethodField()

    class Meta:
        model = Comment
        fields = [
            "id", "user", "content", "is_system",
            "is_edited", "is_deleted", "mentions",
            "created_at", "edited_at",
        ]

    def get_mentions(self, obj):
        """
        Extract @mentions from comment content.
        Format in content: @[user-uuid]
        Returns list of user UUIDs that were mentioned.
        """
        import re
        if obj.is_system or obj.is_deleted:
            return []
        pattern = r'@\[([0-9a-f-]+)\]'
        return re.findall(pattern, obj.content)


class CreateCommentSerializer(serializers.Serializer):
    """
    Input for creating a new user comment.

    Input:
    {
        "content": "I found the issue. @[uuid-of-charlie] can you review?"
    }

    @mentions use format: @[user-uuid]
    The frontend converts "@Charlie" display to @[uuid] before sending.
    """

    content = serializers.CharField(max_length=5000)


class EditCommentSerializer(serializers.Serializer):
    """Edit a comment (own comments only, within 24h window)."""

    content = serializers.CharField(max_length=5000)