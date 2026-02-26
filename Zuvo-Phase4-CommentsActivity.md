# ZUVO — Phase 4: Comments + Activity Feed + Unread Indicators

> **What we're building**: Task comments, team activity feeds for all roles,
> and Discord-style unread indicators on the Kanban board.
> No notification bell — activity feeds and visual cues replace it.

---

## Phase 4 Overview

| Step | What | Files |
|------|------|-------|
| **P3 Patch** | | |
| 0A | Bulk task operations endpoint | `views.py`, `serializers.py`, `urls.py` |
| **Phase 4 Core** | | |
| 1 | Comment + UserTeamView models | `models.py` |
| 2 | Comment serializers | `serializers.py` |
| 3 | Comment views (CRUD + system comments) | `views.py` |
| 4 | Activity feed views (team-scoped, role-aware) | `views.py` |
| 5 | Unread tracking (last_viewed per user per team) | `views.py` |
| 6 | URL routes | `urls.py` |
| 7 | Frontend types + hooks | `types/`, `hooks/` |
| 8 | Comments section in TaskDetailPanel | Component update |
| 9 | Home page activity feed (enhanced, role-scoped) | `home/page.tsx` update |
| 10 | Board unread indicators | `board/page.tsx` update |

---

# PHASE 3 PATCH

## Step 0A: Bulk Task Operations

This endpoint lets users select multiple tasks from the List View and change their status, priority, or assignee in one action.

### Add serializer to `backend/accounts/serializers.py`:

```python
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
        change_status  → value = column_id (UUID)
        change_priority → value = "critical" | "high" | "medium" | "low"
        assign         → value = user_id (UUID)
        unassign       → value = user_id (UUID)
        delete         → value = not required
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
```

### Add view to `backend/accounts/views.py`:

```python
class BulkTaskActionView(APIView):
    """
    POST /api/teams/{team_id}/tasks/bulk/
    
    Perform bulk operations on multiple tasks.
    
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

        # Verify team access
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
            msg = f"{count} tasks moved to {column.name}."

        elif action == "change_priority":
            if value not in ["critical", "high", "medium", "low"]:
                return Response(
                    {"error": "Invalid priority."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            tasks.update(priority=value)
            msg = f"{count} tasks set to {value} priority."

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
            msg = f"{target_user.full_name} assigned to {count} tasks."

        elif action == "unassign":
            TaskAssignee.objects.filter(
                task__in=tasks, user_id=value
            ).delete()
            msg = f"User removed from {count} tasks."

        elif action == "delete":
            # Only Admin or Dept Head can bulk delete
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
            msg = f"{count} tasks deleted."

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
            },
            request=request,
        )

        return Response({"message": msg, "affected_count": count})
```

### Add URL to `backend/accounts/urls.py`:

```python
    # ── Bulk Task Operations ──
    path("teams/<uuid:team_id>/tasks/bulk/", views.BulkTaskActionView.as_view(), name="task-bulk"),
```

### Add frontend hook to `frontend/src/hooks/useApi.ts`:

```typescript
// Inside useBoard hook, add:

  const bulkAction = useCallback(async (
    taskIds: string[],
    action: "change_status" | "change_priority" | "assign" | "unassign" | "delete",
    value?: string,
  ) => {
    try {
      const res = await api.post(`/teams/${teamId}/tasks/bulk/`, {
        task_ids: taskIds,
        action,
        value,
      });
      // Refresh board after bulk action
      await fetchBoard();
      return { success: true, message: res.data.message };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Bulk action failed.",
      };
    }
  }, [teamId, fetchBoard]);

// Add bulkAction to the return object
```

---

# PHASE 4 CORE

## How It All Fits Together

```
┌─────────────────────────────────────────────────────────────────┐
│                      ZUVO AWARENESS SYSTEM                       │
│                                                                   │
│  1. COMMENTS (inside task detail)                                │
│     • User comments: plain text with @mentions                   │
│     • System comments: auto-generated on status/priority/        │
│       assignee changes (creates a full activity trail per task)  │
│     • Edit own comments, delete (admin/dept_head can delete any) │
│                                                                   │
│  2. ACTIVITY FEED (on home page)                                 │
│     • Admin: sees ALL activity across all company teams          │
│     • Dept Head: sees activity for teams they manage             │
│     • Employee: sees activity for teams they belong to           │
│     • Grouped by "Today", "Yesterday", "This Week"              │
│     • Shows: task created/moved/completed, members added,        │
│       comments posted, assignments changed                       │
│                                                                   │
│  3. UNREAD INDICATORS (on kanban board)                          │
│     • Track "last_viewed_at" per user per team                   │
│     • Task cards that changed since last view get a blue dot     │
│     • Column headers show unread count badge                     │
│     • "Mark all as read" action                                  │
│     • Like Discord: subtle but visible "something changed" cues  │
│                                                                   │
│  WHY NOT A NOTIFICATION BELL?                                    │
│  → Activity feeds show context (what happened, where)            │
│  → Unread dots on the board show changes at a glance             │
│  → Less noise, more signal — users see changes where they work   │
│  → Can always add push notifications later if needed             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Comment + UserTeamView Models

Add to the **bottom** of `backend/accounts/models.py`:

```python
# ──────────────────────────────────────────────────────
# 10. COMMENT
# ──────────────────────────────────────────────────────

class Comment(models.Model):
    """
    A comment on a task.
    
    Two types:
    - User comment: typed by a person (is_system=False)
    - System comment: auto-generated when task changes (is_system=True)
    
    System comments create an activity trail:
      "Alice changed status: Not Started → In Progress"
      "Bob was assigned to this task"
      "Priority changed from Medium to Critical"
    
    Soft-deleted (deleted_at set, not actually removed from DB).
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
        prefix = "[System]" if self.is_system else self.user.full_name if self.user else "[Deleted User]"
        return f"{prefix}: {self.content[:50]}"

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    @property
    def is_edited(self):
        return self.edited_at is not None


# ──────────────────────────────────────────────────────
# 11. USER TEAM VIEW (Unread Tracking)
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
```

### Add new AuditLog actions:

```python
    class Action(models.TextChoices):
        # ... existing actions ...
        COMMENT_ADDED = "comment_added", "Comment Added"
        COMMENT_EDITED = "comment_edited", "Comment Edited"
        COMMENT_DELETED = "comment_deleted", "Comment Deleted"
```

### Run migration:

```bash
cd backend
python manage.py makemigrations accounts
python manage.py migrate
```

---

## Step 2: Comment Serializers

Add to `backend/accounts/serializers.py`:

```python
# ──────────────────────────────────────────────────────
# 9. COMMENT SERIALIZERS
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
    Input for creating a comment.
    
    Input:
    {
        "content": "I found the issue. @[uuid-of-charlie] can you review?"
    }
    
    @mentions use format: @[user-uuid]
    The frontend converts "@Charlie" display to @[uuid] before sending.
    """

    content = serializers.CharField(max_length=5000)


class EditCommentSerializer(serializers.Serializer):
    """Edit a comment (own comments only, within 24h)."""

    content = serializers.CharField(max_length=5000)
```

### Update model imports at top of serializers.py:

```python
from .models import (
    Company, User, PasswordReset, AuditLog,
    Team, TeamMember, BoardColumn, Task, TaskAssignee,
    Comment, UserTeamView,
)
```

---

## Step 3: Comment Views

Add to `backend/accounts/views.py`:

```python
from django.utils import timezone
from datetime import timedelta
from .models import Comment, UserTeamView


# ══════════════════════════════════════════════════════
#  COMMENT VIEWS
# ══════════════════════════════════════════════════════

class CommentListCreateView(APIView):
    """
    GET  /api/teams/{team_id}/tasks/{task_id}/comments/    → List comments
    POST /api/teams/{team_id}/tasks/{task_id}/comments/    → Add comment
    
    System comments are auto-generated by other views when:
    - Task status changes (moved to different column)
    - Task priority changes
    - Assignee added/removed
    These are NOT created here — they're created inside TaskMoveView, etc.
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

        # Don't show content of deleted comments, but keep the entry
        serializer = CommentSerializer(comments, many=True)
        data = serializer.data
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

        # Update task's updated_at to trigger unread indicators
        task.save(update_fields=["updated_at"])

        log_action(
            action=AuditLog.Action.COMMENT_ADDED,
            user=user,
            company=user.company,
            target_type="comment",
            target_id=comment.id,
            metadata={
                "task_title": task.title,
                "team_name": team.name,
                "task_id": str(task.id),
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
    - Admin and Dept Head can delete any comment
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

        # Only author can edit
        if comment.user_id != user.id:
            return Response(
                {"error": "You can only edit your own comments."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Can't edit system comments
        if comment.is_system:
            return Response(
                {"error": "System comments cannot be edited."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Can't edit deleted comments
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

        # Can't delete system comments
        if comment.is_system:
            return Response(
                {"error": "System comments cannot be deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Already deleted
        if comment.is_deleted:
            return Response(
                {"error": "Comment already deleted."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Permission: author, admin, or dept_head of team
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

        # Soft delete
        comment.deleted_at = timezone.now()
        comment.save(update_fields=["deleted_at"])

        return Response({"message": "Comment deleted."})
```

### Add system comment helper function (add near top of views.py):

```python
def create_system_comment(task, content):
    """
    Create an auto-generated system comment on a task.
    Used when task status, priority, or assignees change.
    """
    Comment.objects.create(
        task=task,
        user=None,
        content=content,
        is_system=True,
    )
```

### Update existing views to create system comments:

**In `TaskMoveView.post()`, after the `log_action()` call, add:**

```python
        if old_column_name != target_column.name:
            # ... existing log_action code ...
            
            # Auto-generate system comment
            create_system_comment(
                task,
                f"{user.full_name} changed status: {old_column_name} → {target_column.name}"
            )
```

**In `TaskDetailView.patch()`, after saving, add:**

```python
        # System comments for notable changes
        if "priority" in data:
            create_system_comment(
                task,
                f"{user.full_name} changed priority to {data['priority'].title()}"
            )
```

**In `TaskAssigneeView.post()`, after creating the assignment, add:**

```python
            create_system_comment(
                task,
                f"{user.full_name} assigned {target_user.full_name} to this task"
            )
```

**In `TaskAssigneeView.delete()`, after deleting the assignment, add:**

```python
            create_system_comment(
                task,
                f"{user.full_name} removed {removed_name} from this task"
            )
```

---

## Step 4: Activity Feed Views (Team-Scoped, Role-Aware)

Replace the simple `RecentActivityView` from Phase 3 patch with this enhanced version.

### Replace `RecentActivityView` in `backend/accounts/views.py`:

```python
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
    
    Response includes grouping hints:
        each entry has "date_group": "today" | "yesterday" | "this_week" | "older"
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
            # Admin sees everything in their company
            pass
        elif user.role == "dept_head":
            # Dept Head sees activity for teams they manage
            managed_team_ids = TeamMember.objects.filter(
                user=user, team_role="dept_head",
                team__is_archived=False,
            ).values_list("team_id", flat=True)
            # Also include company-level actions (team created, member added, etc.)
            queryset = queryset.filter(
                models.Q(metadata__team_id__in=[str(t) for t in managed_team_ids])
                | models.Q(metadata__has_key="team_id", metadata__team_id__in=[str(t) for t in managed_team_ids])
                | models.Q(target_type__in=["team", "team_member"])
            )
        else:
            # Employee sees activity for teams they're in
            member_team_ids = TeamMember.objects.filter(
                user=user,
                team__is_archived=False,
            ).values_list("team_id", flat=True)
            queryset = queryset.filter(
                models.Q(metadata__team_id__in=[str(t) for t in member_team_ids])
                | models.Q(metadata__has_key="team_id", metadata__team_id__in=[str(t) for t in member_team_ids])
            )

        # Optional team filter
        if team_id:
            queryset = queryset.filter(
                metadata__team_id=str(team_id)
            )

        # Cursor pagination
        if before:
            from django.utils.dateparse import parse_datetime
            before_dt = parse_datetime(before)
            if before_dt:
                queryset = queryset.filter(created_at__lt=before_dt)

        entries = queryset[:limit]

        # Build response with date grouping
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        yesterday_start = today_start - timedelta(days=1)
        week_start = today_start - timedelta(days=7)

        data = []
        for entry in entries:
            # Determine date group
            if entry.created_at >= today_start:
                date_group = "today"
            elif entry.created_at >= yesterday_start:
                date_group = "yesterday"
            elif entry.created_at >= week_start:
                date_group = "this_week"
            else:
                date_group = "older"

            # Build human-readable activity text
            activity_text = self._build_activity_text(entry)

            data.append({
                "id": str(entry.id),
                "action": entry.action,
                "action_display": entry.get_action_display(),
                "activity_text": activity_text,
                "user_name": entry.user.full_name if entry.user else "System",
                "user_id": str(entry.user.id) if entry.user else None,
                "target_type": entry.target_type,
                "metadata": entry.metadata or {},
                "date_group": date_group,
                "created_at": entry.created_at.isoformat(),
            })

        # Check if there are more items
        has_more = queryset.count() > limit

        return Response({
            "activities": data,
            "has_more": has_more,
            "next_cursor": data[-1]["created_at"] if data else None,
        })

    def _build_activity_text(self, entry):
        """Build a human-readable activity string."""
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
```

### Important: Update existing log_action calls to include `team_id` in metadata

Go through all the views that call `log_action()` and make sure the `metadata` dict includes `"team_id": str(team.id)`. This is what the activity feed filters on.

**Example — in `TaskListCreateView.post()`:**
```python
        log_action(
            action=AuditLog.Action.TASK_CREATED,
            user=user,
            company=user.company,
            target_type="task",
            target_id=task.id,
            metadata={
                "title": task.title,
                "team_name": team.name,
                "team_id": str(team.id),    # ← ADD THIS
                "priority": task.priority,
                "assignees": [str(uid) for uid in assignee_ids],
            },
            request=request,
        )
```

**Do the same for ALL log_action calls in:**
- `TeamListCreateView.post()` — add `"team_id": str(team.id)`
- `TeamDetailView.patch()` — add `"team_id": str(team.id)`
- `TeamDetailView.delete()` — add `"team_id": str(team.id)`
- `TeamMembersView.post()` — add `"team_id": str(team.id)`
- `TeamMemberInviteView.post()` — add `"team_id": str(team.id)`
- `TeamMemberDetailView.patch()` — add `"team_id": str(team.id)`
- `TeamMemberDetailView.delete()` — add `"team_id": str(team.id)`
- `TaskDetailView.patch()` — add `"team_id": str(team.id)`
- `TaskDetailView.delete()` — add `"team_id": str(team.id)`
- `TaskMoveView.post()` — add `"team_id": str(team.id)`
- `TaskAssigneeView.post()` — add `"team_id": str(team.id)`
- `TaskAssigneeView.delete()` — add `"team_id": str(team.id)`
- `CommentListCreateView.post()` — already includes it

---

## Step 5: Unread Tracking Views

Add to `backend/accounts/views.py`:

```python
# ══════════════════════════════════════════════════════
#  UNREAD TRACKING VIEWS
# ══════════════════════════════════════════════════════

class MarkTeamViewedView(APIView):
    """
    POST /api/teams/{team_id}/viewed/
    
    Called when user opens a team's board page.
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
    
    Returns unread task counts for all of the user's teams.
    Used on the home page to show "3 new changes" badges on team cards.
    
    Response:
    {
        "teams": {
            "team-uuid-1": { "unread_count": 5, "last_viewed_at": "..." },
            "team-uuid-2": { "unread_count": 0, "last_viewed_at": "..." }
        }
    }
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Get user's teams
        if user.role == "admin":
            teams = Team.objects.filter(
                company=user.company, is_archived=False
            )
        else:
            member_team_ids = TeamMember.objects.filter(
                user=user, team__is_archived=False
            ).values_list("team_id", flat=True)
            teams = Team.objects.filter(id__in=member_team_ids)

        # Get all view records for this user
        view_records = {
            str(v.team_id): v.last_viewed_at
            for v in UserTeamView.objects.filter(
                user=user, team__in=teams
            )
        }

        result = {}
        for team in teams:
            team_id_str = str(team.id)
            last_viewed = view_records.get(team_id_str)

            if last_viewed:
                # Count tasks updated since last view
                unread_count = Task.objects.filter(
                    team=team,
                    updated_at__gt=last_viewed,
                ).count()
            else:
                # Never viewed — all tasks are "unread"
                unread_count = Task.objects.filter(team=team).count()

            result[team_id_str] = {
                "unread_count": unread_count,
                "last_viewed_at": last_viewed.isoformat() if last_viewed else None,
            }

        return Response({"teams": result})
```

### Enhance BoardView to include unread info:

**In the existing `BoardView.get()`, add this before the return statement:**

```python
        # Get user's last viewed timestamp for this team
        last_viewed_at = None
        try:
            view_record = UserTeamView.objects.get(user=user, team=team)
            last_viewed_at = view_record.last_viewed_at
        except UserTeamView.DoesNotExist:
            pass

        # Add unread flag to each task
        for col in serializer.data:
            for task_data in col["tasks"]:
                if last_viewed_at:
                    task_updated = task_data.get("updated_at")
                    if task_updated:
                        from django.utils.dateparse import parse_datetime
                        updated_dt = parse_datetime(task_updated)
                        task_data["is_unread"] = updated_dt > last_viewed_at if updated_dt else False
                    else:
                        task_data["is_unread"] = False
                else:
                    task_data["is_unread"] = True  # Never viewed = all unread

        return Response({
            "team_id": str(team.id),
            "team_name": team.name,
            "team_icon": team.icon,
            "team_color": team.color,
            "columns": serializer.data,
            "last_viewed_at": last_viewed_at.isoformat() if last_viewed_at else None,
        })
```

---

## Step 6: URL Routes

Add to `backend/accounts/urls.py`:

```python
    # ── Phase 3 Patch: Bulk ──
    path("teams/<uuid:team_id>/tasks/bulk/", views.BulkTaskActionView.as_view(), name="task-bulk"),

    # ── Comments ──
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/comments/", views.CommentListCreateView.as_view(), name="comment-list-create"),
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/comments/<uuid:comment_id>/", views.CommentDetailView.as_view(), name="comment-detail"),

    # ── Activity Feed ──
    path("activity/feed/", views.ActivityFeedView.as_view(), name="activity-feed"),

    # ── Unread Tracking ──
    path("teams/<uuid:team_id>/viewed/", views.MarkTeamViewedView.as_view(), name="team-viewed"),
    path("teams/unread-counts/", views.UnreadCountsView.as_view(), name="unread-counts"),
```

**Remove the old route if present:**
```python
    # REMOVE THIS (replaced by activity/feed/)
    # path("activity/recent/", views.RecentActivityView.as_view(), name="recent-activity"),
```

### Complete Phase 4 Endpoint Summary:

```
POST   /api/teams/{id}/tasks/bulk/                                 → Bulk task operations
GET    /api/teams/{tid}/tasks/{taskId}/comments/                   → List comments
POST   /api/teams/{tid}/tasks/{taskId}/comments/                   → Add comment
PATCH  /api/teams/{tid}/tasks/{taskId}/comments/{cid}/             → Edit comment
DELETE /api/teams/{tid}/tasks/{taskId}/comments/{cid}/             → Delete comment (soft)
GET    /api/activity/feed/                                         → Activity feed (role-scoped)
POST   /api/teams/{id}/viewed/                                     → Mark team as viewed
GET    /api/teams/unread-counts/                                   → Unread counts per team
```

---

## Step 7: Frontend Types + Hooks

### Add to `frontend/src/types/index.ts`:

```typescript
// ── Comments ──

export interface CommentInfo {
  id: string;
  user: User | null;
  content: string;
  is_system: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  mentions: string[];
  created_at: string;
  edited_at: string | null;
}

// ── Activity Feed ──

export interface ActivityEntry {
  id: string;
  action: string;
  action_display: string;
  activity_text: string;
  user_name: string;
  user_id: string | null;
  target_type: string;
  metadata: Record<string, any>;
  date_group: "today" | "yesterday" | "this_week" | "older";
  created_at: string;
}

// ── Unread Tracking ──

export interface UnreadCounts {
  [teamId: string]: {
    unread_count: number;
    last_viewed_at: string | null;
  };
}
```

### Add hooks to `frontend/src/hooks/useApi.ts`:

```typescript
import type {
  // ... existing imports ...
  CommentInfo, ActivityEntry, UnreadCounts,
} from "@/types";


// ══════════════════════════════════════════════════════
//  useComments — for Task Detail comments section
// ══════════════════════════════════════════════════════

export function useComments(teamId: string, taskId: string) {
  const [comments, setComments] = useState<CommentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!teamId || !taskId) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/teams/${teamId}/tasks/${taskId}/comments/`);
      setComments(res.data.comments);
    } catch (err) {
      console.error("Failed to fetch comments:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, taskId]);

  const addComment = useCallback(async (content: string) => {
    try {
      const res = await api.post(`/teams/${teamId}/tasks/${taskId}/comments/`, { content });
      setComments((prev) => [...prev, res.data.comment]);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to add comment.",
      };
    }
  }, [teamId, taskId]);

  const editComment = useCallback(async (commentId: string, content: string) => {
    try {
      const res = await api.patch(
        `/teams/${teamId}/tasks/${taskId}/comments/${commentId}/`,
        { content }
      );
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? res.data.comment : c))
      );
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to edit comment.",
      };
    }
  }, [teamId, taskId]);

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await api.delete(
        `/teams/${teamId}/tasks/${taskId}/comments/${commentId}/`
      );
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, is_deleted: true, content: "[This comment was deleted]" }
            : c
        )
      );
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to delete comment.",
      };
    }
  }, [teamId, taskId]);

  return { comments, isLoading, fetchComments, addComment, editComment, deleteComment };
}


// ══════════════════════════════════════════════════════
//  useActivityFeed — for Home Page (replaces useRecentActivity)
// ══════════════════════════════════════════════════════

export function useActivityFeed() {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const fetchActivity = useCallback(async (
    options?: { limit?: number; teamId?: string; reset?: boolean }
  ) => {
    const { limit = 20, teamId, reset = true } = options || {};
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (teamId) params.set("team_id", teamId);
      if (!reset && nextCursor) params.set("before", nextCursor);

      const res = await api.get(`/activity/feed/?${params.toString()}`);

      if (reset) {
        setActivities(res.data.activities);
      } else {
        setActivities((prev) => [...prev, ...res.data.activities]);
      }
      setHasMore(res.data.has_more);
      setNextCursor(res.data.next_cursor);
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    } finally {
      setIsLoading(false);
    }
  }, [nextCursor]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      fetchActivity({ reset: false });
    }
  }, [hasMore, isLoading, fetchActivity]);

  // Group activities by date
  const groupedActivities = useMemo(() => {
    const groups: Record<string, ActivityEntry[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      older: [],
    };
    for (const entry of activities) {
      groups[entry.date_group]?.push(entry);
    }
    return groups;
  }, [activities]);

  return {
    activities, groupedActivities, isLoading, hasMore,
    fetchActivity, loadMore,
  };
}


// ══════════════════════════════════════════════════════
//  useUnreadCounts — for Home Page team card badges
// ══════════════════════════════════════════════════════

export function useUnreadCounts() {
  const [unreadCounts, setUnreadCounts] = useState<UnreadCounts>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchUnreadCounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/teams/unread-counts/");
      setUnreadCounts(res.data.teams);
    } catch (err) {
      console.error("Failed to fetch unread counts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const markTeamViewed = useCallback(async (teamId: string) => {
    try {
      await api.post(`/teams/${teamId}/viewed/`);
      // Clear unread for this team locally
      setUnreadCounts((prev) => ({
        ...prev,
        [teamId]: { unread_count: 0, last_viewed_at: new Date().toISOString() },
      }));
    } catch (err) {
      console.error("Failed to mark team viewed:", err);
    }
  }, []);

  return { unreadCounts, isLoading, fetchUnreadCounts, markTeamViewed };
}
```

**Add `useMemo` to the imports at top of useApi.ts:**
```typescript
import { useState, useCallback, useMemo } from "react";
```

---

## Step 8: Comments Section in TaskDetailPanel

### Update `frontend/src/components/TaskDetailPanel.tsx`:

Add these new props and the comments section:

```typescript
// Add to imports:
import { useComments } from "@/hooks/useApi";

// Add to props interface:
interface TaskDetailPanelProps {
  // ... existing props ...
  teamId: string;   // ← ADD
}

// Inside the component, add:
export default function TaskDetailPanel({
  task, isLoading, members, canManage, teamId,
  onClose, onUpdateTask, onDeleteTask, onAddAssignee, onRemoveAssignee,
}: TaskDetailPanelProps) {

  // ── Comment states ──
  const {
    comments, isLoading: commentsLoading,
    fetchComments, addComment, editComment, deleteComment,
  } = useComments(teamId, task?.id || "");

  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // Fetch comments when task loads
  useEffect(() => {
    if (task?.id) {
      fetchComments();
    }
  }, [task?.id, fetchComments]);

  // Submit new comment
  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    setIsSubmitting(true);
    const result = await addComment(commentText.trim());
    if (result.success) {
      setCommentText("");
    }
    setIsSubmitting(false);
  };

  // Start editing a comment
  const startEditComment = (comment: CommentInfo) => {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
  };

  // Save edited comment
  const saveEditComment = async () => {
    if (!editingCommentId || !editingContent.trim()) return;
    await editComment(editingCommentId, editingContent.trim());
    setEditingCommentId(null);
    setEditingContent("");
  };

  // Delete a comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    await deleteComment(commentId);
  };

  // Check if current user can edit/delete a comment
  const canEditComment = (comment: CommentInfo) => {
    if (comment.is_system || comment.is_deleted) return false;
    return comment.user?.id === currentUserId;
  };

  const canDeleteComment = (comment: CommentInfo) => {
    if (comment.is_system || comment.is_deleted) return false;
    if (comment.user?.id === currentUserId) return true;
    return canManage; // admin or dept_head
  };

  // @mention helper: convert display names to @[uuid] format
  const processMentions = (text: string): string => {
    // The UI shows @Alice but we store @[uuid]
    // This is handled by the @mention dropdown in the input
    return text;
  };

  // ── YOUR STITCH COMMENTS UI ──
  //
  // COMMENTS SECTION (below description in task detail panel):
  //
  //   Section header: "Comments" + count like "(7)"
  //
  //   commentsLoading                        → loading skeleton
  //   comments.map(comment => ...)           → comment list:
  //
  //   FOR USER COMMENTS (comment.is_system === false):
  //     comment.user?.full_name              → "Alice Johnson"
  //     comment.user (avatar/initials)       → avatar circle
  //     comment.content                      → comment text
  //       Replace @[uuid] with styled @Name  → highlighted in coral
  //     comment.created_at                   → "Jan 18 at 2:30 PM"
  //     comment.is_edited                    → show "(edited)" in muted text
  //     comment.is_deleted                   → show "[This comment was deleted]" in italic muted
  //
  //     Edit button (pencil icon):
  //       canEditComment(comment)            → show/hide
  //       startEditComment(comment)          → click handler
  //     Delete button (trash icon):
  //       canDeleteComment(comment)          → show/hide
  //       handleDeleteComment(comment.id)    → click handler
  //
  //     EDITING STATE (editingCommentId === comment.id):
  //       editingContent, setEditingContent  → textarea
  //       saveEditComment                    → save button
  //       () => setEditingCommentId(null)    → cancel button
  //
  //   FOR SYSTEM COMMENTS (comment.is_system === true):
  //     Render differently — smaller, muted, with a system icon (gear/arrow):
  //     "Alice changed status: Not Started → In Progress"
  //     No edit/delete buttons on system comments
  //     Styled as a subtle activity entry, not a chat bubble
  //
  //   COMMENT INPUT (sticky at bottom of panel):
  //     commentText, setCommentText          → textarea
  //     placeholder "Add a comment..."
  //     @mention trigger: when user types @, show dropdown of:
  //       members.map(m => ...)              → member list
  //       clicking inserts @[user-uuid] into text
  //       displays as @Name visually
  //     handleSubmitComment                  → send button (or Ctrl+Enter)
  //     isSubmitting                         → loading state on send button
  //
  //   EMPTY STATE (no comments):
  //     "No comments yet. Start the conversation!"
  //     in muted text with chat icon
```

---

## Step 9: Home Page Activity Feed (Enhanced, Role-Scoped)

### Update `frontend/src/app/(app)/home/page.tsx`:

Replace the old `useRecentActivity` with the new hooks:

```typescript
// Update imports:
import {
  useTeams,
  useActivityFeed,
  useUnreadCounts,
} from "@/hooks/useApi";

// Inside the component:
const { activities, groupedActivities, isLoading: activityLoading, hasMore, fetchActivity, loadMore } = useActivityFeed();
const { unreadCounts, fetchUnreadCounts, markTeamViewed } = useUnreadCounts();

// In useEffect:
useEffect(() => {
  fetchTeams();
  fetchActivity();
  fetchUnreadCounts();
}, [fetchTeams, fetchActivity, fetchUnreadCounts]);

// Navigation handler update:
const navigateToTeamBoard = (teamId: string) => {
  markTeamViewed(teamId); // Clear unread when entering board
  router.push(`/teams/${teamId}/board`);
};
```

Add these bindings to the UI documentation section:

```typescript
  // TEAM CARD ENHANCEMENTS (add to existing team cards):
  //
  //   unreadCounts[team.id]?.unread_count    → unread badge
  //     If > 0, show a small coral badge on the team card:
  //       "3 new changes" or just the number
  //     Badge position: top-right corner of the card
  //     Color: coral accent background with white text
  //     Animate in with a subtle scale bounce
  //
  //   Example:
  //     ┌────────────────────────────┐
  //     │  🔧 Engineering    [3 new] │  ← coral badge
  //     │  ...                       │
  //     └────────────────────────────┘

  // ACTIVITY FEED (below team cards, replaces old simple feed):
  //
  //   Section header: "Activity" with clock icon
  //
  //   Grouped by date:
  //     groupedActivities.today.length > 0:
  //       "Today" sub-header in small bold muted text
  //       groupedActivities.today.map(a => ...)
  //
  //     groupedActivities.yesterday.length > 0:
  //       "Yesterday" sub-header
  //       groupedActivities.yesterday.map(a => ...)
  //
  //     groupedActivities.this_week.length > 0:
  //       "This Week" sub-header
  //       groupedActivities.this_week.map(a => ...)
  //
  //     groupedActivities.older.length > 0:
  //       "Older" sub-header
  //       groupedActivities.older.map(a => ...)
  //
  //   Each activity entry:
  //     a.user_name                          → avatar + name
  //     a.activity_text                      → human-readable text
  //       "Alice moved 'Fix auth bug' from Not Started → In Progress"
  //     a.created_at                         → relative time "2h ago"
  //     a.metadata.team_name                 → team badge/tag
  //     a.action                             → icon:
  //       task_created → ➕ icon
  //       task_moved → ↗️ icon
  //       task_assigned → 👤 icon
  //       comment_added → 💬 icon
  //       member_added → 🤝 icon
  //       team_created → 🏗️ icon
  //
  //   Activity entries: surface card-like rows with left border
  //     color-coded by action type:
  //       task actions → blue left border
  //       team actions → coral left border
  //       comment actions → green left border
  //
  //   hasMore && <button onClick={loadMore}>Load More</button>
  //   activityLoading → skeleton entries
  //
  //   ROLE DIFFERENCES:
  //     Admin: sees ALL activity, all teams
  //     Dept Head: sees only their managed teams' activity
  //     Employee: sees only their teams' activity
  //     (This is handled server-side — same UI for all roles)
```

---

## Step 10: Board Unread Indicators

### Update `frontend/src/app/(app)/teams/[teamId]/board/page.tsx`:

Add the unread tracking:

```typescript
// Add import:
import { useUnreadCounts } from "@/hooks/useApi";

// Inside component, add:
const { markTeamViewed } = useUnreadCounts();

// Mark as viewed when board loads:
useEffect(() => {
  markTeamViewed(teamId);
}, [teamId, markTeamViewed]);

// Also mark as viewed periodically (every 60s while board is open):
useEffect(() => {
  const interval = setInterval(() => {
    markTeamViewed(teamId);
  }, 60000);
  return () => clearInterval(interval);
}, [teamId, markTeamViewed]);

// "Mark all as read" handler:
const handleMarkAllRead = () => {
  markTeamViewed(teamId);
  // Clear unread flags locally
  setBoard((prev) => {
    if (!prev) return prev;
    return {
      ...prev,
      columns: prev.columns.map((col) => ({
        ...col,
        tasks: col.tasks.map((t) => ({ ...t, is_unread: false })),
      })),
    };
  });
};
```

Add these UI bindings:

```typescript
  // UNREAD INDICATORS (Discord-style):
  //
  // On individual task cards:
  //   task.is_unread === true              → show blue dot indicator
  //     Small blue dot (8px) at top-left corner of card
  //     Color: info blue #60A5FA
  //     Subtle pulse animation (opacity 0.6 → 1.0, 2s loop)
  //     When user clicks the card (opens detail), dot disappears
  //
  // On column headers:
  //   Count unread tasks per column:
  //     const unreadInColumn = col.tasks.filter(t => t.is_unread).length;
  //     If unreadInColumn > 0:
  //       Show small blue badge next to column name
  //       "IN PROGRESS (3) 🔵2" ← "2" is unread count in blue
  //
  // Board-level "Mark all as read" button:
  //   Show in the sub-header bar if any tasks are unread:
  //     const totalUnread = board?.columns
  //       .flatMap(c => c.tasks)
  //       .filter(t => t.is_unread).length || 0;
  //     
  //     totalUnread > 0:
  //       Show "✓ Mark all read" text button in muted/coral text
  //       handleMarkAllRead on click
  //
  // Visual hierarchy of unread indicators:
  //   ┌─────────────────────────────────────────────────┐
  //   │  🔧 Engineering   [Board] [List]   ✓ Mark read  │
  //   │─────────────────────────────────────────────────│
  //   │                                                  │
  //   │  NOT STARTED (4)   IN PROGRESS (3) 🔵2          │
  //   │  ───────────────   ─────────────────            │
  //   │  ┌──────────────┐  ┌──────────────┐             │
  //   │  │🔵 Fix auth   │  │  Update dash │             │
  //   │  │  bug         │  │              │             │
  //   │  └──────────────┘  └──────────────┘             │
  //   │  ┌──────────────┐  ┌──────────────┐             │
  //   │  │  Design      │  │🔵 Payment   │             │
  //   │  │  review      │  │  gateway     │             │
  //   │  └──────────────┘  └──────────────┘             │
  //   └─────────────────────────────────────────────────┘
  //
  //   🔵 = blue unread dot on cards that changed since last visit
```

---

## Summary — All Phase 4 Files

### Backend (modified):
```
accounts/models.py          ← ADD Comment + UserTeamView models + 3 AuditLog actions
accounts/serializers.py     ← ADD BulkTaskAction, Comment, CreateComment, EditComment serializers
accounts/views.py           ← ADD BulkTaskAction, CommentListCreate, CommentDetail,
                               ActivityFeed, MarkTeamViewed, UnreadCounts views
                             + UPDATE existing views to create system comments
                             + UPDATE all log_action calls to include team_id
accounts/urls.py            ← ADD 6 new URL routes
```

### Frontend (new/modified):
```
src/types/index.ts                    ← ADD CommentInfo, ActivityEntry, UnreadCounts types
src/hooks/useApi.ts                   ← ADD useComments, useActivityFeed, useUnreadCounts hooks
                                        + ADD bulkAction to useBoard
                                        + REPLACE useRecentActivity
src/components/TaskDetailPanel.tsx    ← UPDATE: add comments section + teamId prop
src/app/(app)/home/page.tsx           ← UPDATE: enhanced activity feed + unread badges
src/app/(app)/teams/[teamId]/board/   ← UPDATE: unread indicators + mark as read
```

### New API Endpoints (8 total):
```
POST   /api/teams/{id}/tasks/bulk/                             → Bulk operations
GET    /api/teams/{tid}/tasks/{taskId}/comments/               → List comments
POST   /api/teams/{tid}/tasks/{taskId}/comments/               → Add comment
PATCH  /api/teams/{tid}/tasks/{taskId}/comments/{cid}/         → Edit comment
DELETE /api/teams/{tid}/tasks/{taskId}/comments/{cid}/         → Soft-delete comment
GET    /api/activity/feed/                                     → Role-scoped activity feed
POST   /api/teams/{id}/viewed/                                 → Mark team as viewed
GET    /api/teams/unread-counts/                               → Unread counts per team
```

---

## What's Next — Phase 5

**Phase 5: Company Settings + Profile + Audit**
- `/company/members` → Admin manages all company users
- `/company/settings` → Company name, description
- `/profile` → User profile editing (name, avatar, timezone, password change)
- `/admin/audit-log` → Super Admin platform-wide audit log viewer
