import uuid
from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


# ──────────────────────────────────────────────
# 1. COMPANY MODEL
# ──────────────────────────────────────────────
# Each client company is one row in this table.
# Super Admin creates these from the admin dashboard.

class Company(models.Model):

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,                     # Auto-generate a unique ID
        editable=False
    )

    # WHY UUID instead of 1, 2, 3?
    # Auto-increment IDs are guessable. If someone sees company/3,
    # they can try company/4. UUIDs are random and unguessable. 

    name = models.CharField(
        max_length=255,
        help_text="Company name, e.g. 'Acme Corporation'"
    )   

    description = models.TextField(
        blank=True,              # Allowed to be empty in forms
        default="",             # Default value in database
        help_text="Brief description or remarks about the company"
    )

    logo_url = models.URLField(
        blank=True,
        null=True,          # Allowed to be NULL in database
        help_text="URL to company logo image"
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Soft delete — set to False instead of deleting"
    )

    # WHY soft delete?
    # We never actually DELETE a company. We set is_active=False.
    # This way, if it was a mistake, we can recover within 30 days.

    created_at = models.DateTimeField(
        auto_now_add=True
    )
    # auto_now_add=True means Django sets this automatically when 
    # the record is first created. No need to set it manually.

    updated_at = models.DateTimeField(
        auto_now=True
    )
    # auto_now=True means Django updates this every time you save.

    class Meta:
        verbose_name_plural = "Companies"       # Fix plural name in admin
        ordering = ["-created_at"]              # Newest companies first

    def __str__(self):
         """What shows when you print a Company object."""
         return self.name
    

# ──────────────────────────────────────────────
# 2. CUSTOM USER MANAGER
# ──────────────────────────────────────────────
# Django needs a "manager" to know how to create users.
# Since we're using email (not username) for login,
# we need to customize this.

class UserManager(BaseUserManager):
    
     
    # Custom manager for our User model.
    # Handles user creation with email as the login field.

    def create_user(self, email, password=None, **extra_fields):

        """
        Create a regular user.
        
        Usage:
            User.objects.create_user(
                email="john@acme.com",
                password="temp123",
                full_name="John Miller",
                company=acme_company
            )
        """

        if not email:
            raise ValueError("Email is required")

        # Normalize = lowercase the domain part of email
        # "John@ACME.COM" becomes "John@acme.com"
        email = self.normalize_email(email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)  # This hashes the password!
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """
        Create a super admin user (platform-level).
        Used by our management command, not by the app directly.
        """
        extra_fields.setdefault("role", "super_admin")
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_password_temp", False)

        return self.create_user(email, password, **extra_fields)
    

# ──────────────────────────────────────────────
# 3. USER MODEL
# ──────────────────────────────────────────────
# This is THE most important model. Every person who logs in
# is a row in this table.

class User(AbstractBaseUser, PermissionsMixin):

    #     Custom User model for Zuvo.
    
    # WHY custom instead of Django's built-in User?
    # - Django's User uses 'username' for login — we want 'email'
    # - We need extra fields: company, role, phone, temp password flag
    # - We need UUID primary keys
    # - We need the company foreign key for multi-tenant isolation

        # ── Role Choices ──
    # These are the only valid values for the 'role' field.
    class Role(models.TextChoices):
        SUPER_ADMIN = "super_admin", "Super Admin"
        ADMIN = "admin", "Admin"
        DEPT_HEAD = "dept_head", "Department Head"
        EMPLOYEE = "employee", "Employee"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    # ── Company Link ──
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="users",
        null=True,
        blank=True,
        help_text="The company this user belongs to. Null for Super Admins."
    )

    # WHAT IS ForeignKey?
    # It's a link to another table. This user "belongs to" a company.
    # In the database, this creates a column called "company_id"
    # that stores the UUID of the company.

    # ── Basic Info ──
    email = models.EmailField(
        unique=True,            # No two users can have the same email
        help_text="Primary email — used as login username"
    )

    email_secondary = models.EmailField(
        blank=True,
        null=True,
        help_text="Optional backup/secondary email"
    )

    full_name = models.CharField(
        max_length=255,
        help_text="User's display name",
    )

    contact_number = models.CharField(
        max_length=20,
        blank=True,
        default="",
        help_text="Phone number"
    )

    avatar_url = models.URLField(
        blank=True,
        null=True,
        help_text="URL to user's avatar image"
    )

    # ── Role & Title ──
    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EMPLOYEE,
        help_text="System role — controls permissions"
    )

    job_title = models.CharField(
        max_length=255,
        blank=True,
        default="",
        help_text="Display title, e.g. 'Marketing Head', 'Frontend Developer'"
    )

    # role = system permission level (admin, dept_head, employee)
    # job_title = display label (Marketing Head, CEO, Intern, etc.)
    # They're separate because a CEO and CTO are both "admin" role
    # but have different job titles.

    # ── Status Flags ──
    is_password_temp = models.BooleanField(
        default=True,
        help_text="True = user must reset password on next login"
    )

    is_onboarded = models.BooleanField(
        default=False,
        help_text="True = user has completed onboarding"
    )

    is_active = models.BooleanField(
        default=True,
        help_text="Soft delete — set to False instead of deleting"
    )

    is_staff = models.BooleanField(
        default=False,
        help_text="Required by Django for admin panel access"
    )

    # ── Preferences ──
    timezone = models.CharField(
        max_length=50,
        default="UTC",
        help_text="User's timezone, e.g. 'Asia/Kolkata'"
    )

    # ── Tracking ──
    last_login = models.DateTimeField(
        null=True,
        blank=True,
    )

    created_by = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_users",
        help_text="Which user created this user? Null if created by Super Admin."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


    # ── Django Auth Configuration ──
    objects = UserManager()                # Use our custom manager
    USERNAME_FIELD = "email"               # Login with email, not username
    REQUIRED_FIELDS = ["full_name"]        # Required when creating via command line

    class Meta:
        ordering = ["-created_at"]          # Newest users first

    def __str__(self):
        return f"{self.full_name} ({self.email})"
    
    @property
    def is_super_admin(self):
        """Quick check: is this user a super admin?"""
        return self.role == self.Role.SUPER_ADMIN
    
    @property
    def is_admin(self):
        """Quick check: is this user a company admin?"""
        return self.role == self.Role.ADMIN
    
    @property
    def is_dept_head(self):
        return self.role == self.Role.DEPT_HEAD

    @property
    def is_employee(self):
        return self.role == self.Role.EMPLOYEE
    
# ──────────────────────────────────────────────
# 4. PASSWORD RESET MODEL
# ──────────────────────────────────────────────
# When a user clicks "Forgot Password", we create a reset token.

class PasswordReset(models.Model):
    """
    Stores password reset tokens.
    
    Flow:
    1. User requests reset → we generate a random token
    2. We hash the token (SHA-256) and store the HASH here
    3. We send the raw token to the user's email
    4. User clicks link with raw token → we hash it and compare
    5. If match + not expired + not used → allow password reset
    
    WHY hash the token?
    If a hacker gets access to our database, they'd see all
    reset tokens and could reset anyone's password.
    By storing only the HASH, even a database breach is safe.
    """

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_resets"
    )

    token_hash = models.CharField(
        max_length=64,
        help_text="SHA-256 hash of the reset token"
    )

    expires_at = models.DateTimeField(
        help_text="Token expires after this time (1 hour from creation)"
    )

    used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the token was used (NULL = not used yet)"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Reset for {self.user.email} at {self.created_at}"

    @property
    def is_valid(self):
        """Check if this token can still be used."""
        return (
            self.used_at is None and               # Not already used
            self.expires_at > timezone.now()        # Not expired
        )


# ──────────────────────────────────────────────
# 5. AUDIT LOG MODEL
# ──────────────────────────────────────────────
# Records every important action for security and debugging.

class AuditLog(models.Model):
    """
    Tracks all important actions in the system.
    
    Examples:
    - "Alice logged in" 
    - "Super Admin created company Acme Corporation"
    - "John's password was reset"
    - "Login failed for unknown@email.com (wrong password)"
    """

    class Action(models.TextChoices):
        # Auth actions
        LOGIN_SUCCESS = "login_success", "Login Success"
        LOGIN_FAILED = "login_failed", "Login Failed"
        LOGOUT = "logout", "Logout"
        PASSWORD_RESET = "password_reset", "Password Reset"
        PASSWORD_CHANGED = "password_changed", "Password Changed"
        TEMP_PASSWORD_SET = "temp_password_set", "Temp Password Set"

        # Company actions
        COMPANY_CREATED = "company_created", "Company Created"
        COMPANY_UPDATED = "company_updated", "Company Updated"
        COMPANY_DEACTIVATED = "company_deactivated", "Company Deactivated"

        # User actions
        USER_CREATED = "user_created", "User Created"
        USER_UPDATED = "user_updated", "User Updated"
        USER_DEACTIVATED = "user_deactivated", "User Deactivated"
        USER_ROLE_CHANGED = "user_role_changed", "User Role Changed"

        # Onboarding
        ONBOARDING_COMPLETED = "onboarding_completed", "Onboarding Completed"

        # Team actions
        TEAM_CREATED = "team_created", "Team Created"
        TEAM_UPDATED = "team_updated", "Team Updated"
        TEAM_ARCHIVED = "team_archived", "Team Archived"
        MEMBER_ADDED = "member_added", "Member Added to Team"
        MEMBER_REMOVED = "member_removed", "Member Removed from Team"
        MEMBER_ROLE_CHANGED = "member_role_changed", "Member Role Changed"
        USER_INVITED_TO_TEAM = "user_invited_to_team", "User Invited to Team"

        TASK_CREATED = "task_created", "Task Created"
        TASK_UPDATED = "task_updated", "Task Updated"
        TASK_MOVED = "task_moved", "Task Moved"
        TASK_DELETED = "task_deleted", "Task Deleted"
        TASK_ASSIGNED = "task_assigned", "Task Assigned"
        TASK_UNASSIGNED = "task_unassigned", "Task Unassigned"

        COMMENT_ADDED = "comment_added", "Comment Added"
        COMMENT_EDITED = "comment_edited", "Comment Edited"
        COMMENT_DELETED = "comment_deleted", "Comment Deleted"

    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="Which company this action relates to"
    )

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="Who performed this action"
    )

    action = models.CharField(
        max_length=30,
        choices=Action.choices,
        help_text="What happened"
    )

    target_type = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text="Type of object affected: 'user', 'company', etc."
    )

    target_id = models.UUIDField(
        null=True,
        blank=True,
        help_text="ID of the affected object"
    )

    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Extra details as JSON, e.g. {'old_role': 'employee', 'new_role': 'admin'}"
    )
    # JSONField stores flexible data. We don't need a column for 
    # every possible detail — just dump it as JSON.

    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        help_text="IP address of the request"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Database indexes = faster searches
            # We'll often search logs by company, user, and action
            models.Index(fields=["company", "-created_at"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["action", "-created_at"]),
        ]

    def __str__(self):
        user_email = self.user.email if self.user else "System"
        return f"{user_email} — {self.action} — {self.created_at}"
    

# ──────────────────────────────────────────────────────
# 6. TEAM
# ──────────────────────────────────────────────────────

class Team(models.Model):
    """
    A team within a company (e.g., Engineering, Design, Marketing).
    
    Teams are the core organizational unit. Tasks live inside teams.
    Only Admins can create teams. Dept Heads manage their assigned teams.
    
    Example:
        Team(name="Engineering", company=acme, icon="🔧", color="#FF6B6B")
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name="teams",
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    icon = models.CharField(max_length=10, default="📁")  # emoji
    color = models.CharField(max_length=7, default="#FF6B6B")  # hex color

    created_by = models.ForeignKey(
        "User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_teams",
    )
    is_archived = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        # Team names should be unique within a company
        constraints = [
            models.UniqueConstraint(
                fields=["company", "name"],
                condition=models.Q(is_archived=False),
                name="unique_active_team_name_per_company",
            )
        ]

    def __str__(self):
        return f"{self.icon} {self.name} ({self.company.name})"


# ──────────────────────────────────────────────────────
# 7. TEAM MEMBER (junction table)
# ──────────────────────────────────────────────────────

class TeamMember(models.Model):
    """
    Links a user to a team with a specific role.
    
    A user can be in multiple teams.
    A user can have different roles in different teams.
    
    team_role choices:
        - dept_head: Can manage team members, edit team settings
        - employee: Can view team, manage own tasks
    """

    class TeamRole(models.TextChoices):
        DEPT_HEAD = "dept_head", "Department Head"
        EMPLOYEE = "employee", "Employee"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="members",
    )
    user = models.ForeignKey(
        "User",
        on_delete=models.CASCADE,
        related_name="team_memberships",
    )
    team_role = models.CharField(
        max_length=20,
        choices=TeamRole.choices,
        default=TeamRole.EMPLOYEE,
    )
    added_by = models.ForeignKey(
        "User",
        on_delete=models.SET_NULL,
        null=True,
        related_name="added_team_members",
    )
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["joined_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "user"],
                name="unique_user_per_team",
            )
        ]

    def __str__(self):
        return f"{self.user.full_name} → {self.team.name} ({self.team_role})"
    
# ──────────────────────────────────────────────────────
# 8. BOARD COLUMN
# ──────────────────────────────────────────────────────

class BoardColumn(models.Model):
    """
    A column on a team's Kanban board (e.g., "Not Started", "In Progress").
    
    Each team gets 6 default columns auto-created via signal.
    Admins/Dept Heads can rename, reorder, or add custom columns.
    
    Position determines left-to-right order on the board.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="columns",
    )
    name = models.CharField(max_length=100)
    position = models.IntegerField(default=0)
    color = models.CharField(max_length=7, blank=True, default="")  # hex color
    is_default = models.BooleanField(default=False)  # can't be deleted if True
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(
                fields=["team", "position"],
                name="unique_column_position_per_team",
            )
        ]

    def __str__(self):
        return f"{self.name} (pos {self.position}) — {self.team.name}"


# ──────────────────────────────────────────────────────
# 9. TASK
# ──────────────────────────────────────────────────────

class Task(models.Model):
    """
    A task on the Kanban board.
    
    Lives inside a team, positioned in a board column.
    Can be assigned to multiple team members.
    Position is a float for easy reordering (insert between two tasks).
    """

    class Priority(models.TextChoices):
        CRITICAL = "critical", "Critical"
        HIGH = "high", "High"
        MEDIUM = "medium", "Medium"
        LOW = "low", "Low"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    column = models.ForeignKey(
        BoardColumn,
        on_delete=models.CASCADE,
        related_name="tasks",
    )
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default="")
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    position = models.FloatField(default=0)  # float for easy reordering
    due_date = models.DateTimeField(null=True, blank=True)

    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_tasks",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["position"]

    def __str__(self):
        return f"{self.title} [{self.get_priority_display()}]"


# ──────────────────────────────────────────────────────
# 10. TASK ASSIGNEE (junction table)
# ──────────────────────────────────────────────────────

class TaskAssignee(models.Model):
    """
    Links a user to a task (many-to-many through table).
    A task can have multiple assignees.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="assignees",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="task_assignments",
    )
    assigned_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name="assigned_tasks_to_others",
    )
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["task", "user"],
                name="unique_assignee_per_task",
            )
        ]

    def __str__(self):
        return f"{self.user.full_name} → {self.task.title}"


# ──────────────────────────────────────────────────────
# 11. COMMENT
# ──────────────────────────────────────────────────────

class Comment(models.Model):
    """
    A comment on a task.

    Two types:
    - User comment: typed by a person (is_system=False)
    - System comment: auto-generated when task changes (is_system=True)

    System comments create an activity trail per task:
      "Alice changed status: Not Started → In Progress"
      "Bob was assigned to this task"
      "Priority changed from Medium to Critical"

    Soft-deleted (deleted_at is set rather than removing the row).
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    task = models.ForeignKey(
        Task,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comments",
    )
    content = models.TextField()
    is_system = models.BooleanField(default=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        prefix = (
            "[System]" if self.is_system
            else self.user.full_name if self.user
            else "[Deleted User]"
        )
        return f"{prefix}: {self.content[:50]}"

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def is_edited(self):
        return self.edited_at is not None


# ──────────────────────────────────────────────────────
# 12. USER TEAM VIEW (Unread Tracking)
# ──────────────────────────────────────────────────────

class UserTeamView(models.Model):
    """
    Tracks when a user last viewed a team's board.

    Used to calculate "unread" indicators:
    - Any task with updated_at > last_viewed_at shows a blue dot
    - Column headers show count of unread tasks
    - Home page team cards show "X new changes" badge

    Updated every time a user opens a team's board page.
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="team_views",
    )
    team = models.ForeignKey(
        Team,
        on_delete=models.CASCADE,
        related_name="user_views",
    )
    last_viewed_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "team"],
                name="unique_user_team_view",
            )
        ]

    def __str__(self):
        return f"{self.user.full_name} → {self.team.name} (last: {self.last_viewed_at})"