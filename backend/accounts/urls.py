"""
Zuvo — Accounts URL Configuration
====================================
Auth + Super Admin endpoints.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ── Auth ──
    path("auth/login/", views.LoginView.as_view(), name="auth-login"),
    path("auth/set-password/", views.SetPasswordView.as_view(), name="auth-set-password"),
    path("auth/logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),

    # ── User Profile ──
    path("users/me/", views.MeView.as_view(), name="user-me"),

    # ── Super Admin: Client Companies ──
    path("admin/clients/",
         views.ClientListCreateView.as_view(),
         name="admin-client-list"),

    path("admin/clients/<uuid:pk>/",
         views.ClientDetailView.as_view(),
         name="admin-client-detail"),

    # ── Super Admin: Users within a Company ──
    path("admin/clients/<uuid:pk>/users/",
         views.ClientUserListCreateView.as_view(),
         name="admin-client-users"),

    path("admin/clients/<uuid:pk>/users/<uuid:uid>/",
         views.ClientUserDetailView.as_view(),
         name="admin-client-user-detail"),

    path("admin/clients/<uuid:pk>/users/<uuid:uid>/reset-password/",
         views.ClientUserResetPasswordView.as_view(),
         name="admin-client-user-reset"),

    # ── User Profile ──
    path("users/me/", views.MeView.as_view(), name="user-me"),
    path("users/onboarding/", views.OnboardingView.as_view(), name="user-onboarding"),  # ← ADD

    # ── Teams ──
    path("teams/", views.TeamListCreateView.as_view(), name="team-list-create"),
    path("teams/<uuid:team_id>/", views.TeamDetailView.as_view(), name="team-detail"),
    path("teams/<uuid:team_id>/members/", views.TeamMembersView.as_view(), name="team-members"),
    path("teams/<uuid:team_id>/members/bulk/", views.TeamMembersBulkAddView.as_view(), name="team-members-bulk"),
    path("teams/<uuid:team_id>/members/invite/", views.TeamMemberInviteView.as_view(), name="team-member-invite"),
    path("teams/<uuid:team_id>/members/<uuid:user_id>/", views.TeamMemberDetailView.as_view(), name="team-member-detail"),

    # ── Company ──
    path("company/members/", views.CompanyMembersView.as_view(), name="company-members"),

    # ── Board ──
    path("teams/<uuid:team_id>/board/", views.BoardView.as_view(), name="board"),
    path("teams/<uuid:team_id>/board/columns/", views.BoardColumnsView.as_view(), name="board-columns"),

    # ── Tasks ──
    path("teams/<uuid:team_id>/tasks/", views.TaskListCreateView.as_view(), name="task-list-create"),
    path("teams/<uuid:team_id>/tasks/bulk/", views.BulkTaskActionView.as_view(), name="task-bulk"),
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/", views.TaskDetailView.as_view(), name="task-detail"),
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/move/", views.TaskMoveView.as_view(), name="task-move"),
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/assignees/", views.TaskAssigneeView.as_view(), name="task-assignees"),
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/assignees/<uuid:user_id>/", views.TaskAssigneeView.as_view(), name="task-assignee-detail"),

    # ── Comments ──
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/comments/", views.CommentListCreateView.as_view(), name="comment-list-create"),
    path("teams/<uuid:team_id>/tasks/<uuid:task_id>/comments/<uuid:comment_id>/", views.CommentDetailView.as_view(), name="comment-detail"),

    # ── Activity Feed ──
    path("activity/feed/", views.ActivityFeedView.as_view(), name="activity-feed"),

    # ── Unread Tracking ──
    path("teams/unread-counts/", views.UnreadCountsView.as_view(), name="unread-counts"),
    path("teams/<uuid:team_id>/viewed/", views.MarkTeamViewedView.as_view(), name="team-viewed"),
]