# Zuvo — Project Bible for Claude

> **Platform**: Invite-only task management app. "Focus flows forward."
> **Architecture**: Django REST Framework backend + Next.js 15 App Router frontend (separate directories).

---

## Tech Stack

### Backend (`/backend`)
- Python / Django 5 + Django REST Framework
- JWT auth via `djangorestframework-simplejwt`
- Single Django app: `accounts` (contains all models, views, serializers, urls)
- SQLite in dev; settings in `backend/zuvo_backend/settings.py`
- Run: `python manage.py runserver` (port 8000)
- CORS configured for `http://localhost:3000`

### Frontend (`/frontend`)
- Next.js 15 (App Router, TypeScript)
- Tailwind CSS v4 (`tw-animate-css` for animations)
- `sonner` for toasts (installed; `<Toaster>` in `(app)/layout.tsx`)
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop on board
- `lucide-react` for icons
- `next/font/google`: DM Sans (UI) + JetBrains Mono (code/credentials)
- shadcn/ui primitives: `button`, `dropdown-menu` in `src/components/ui/`
- Run: `npm run dev` (port 3000)

---

## Project Structure

```
zuvo/
├── CLAUDE.md                        ← this file
├── Zuvo-Phase4-CommentsActivity.md  ← Phase 4 planning doc
├── backend/
│   ├── zuvo_backend/settings.py
│   └── accounts/
│       ├── models.py        ← all models
│       ├── views.py         ← all API views
│       ├── serializers.py   ← all serializers
│       ├── urls.py          ← all routes
│       ├── permissions.py   ← custom DRF permissions
│       ├── signals.py       ← post-save signals (AuditLog)
│       ├── utils.py         ← shared helpers
│       └── migrations/      ← 0001–0005 applied
└── frontend/src/
    ├── app/
    │   ├── layout.tsx              ← root layout (fonts, AuthProvider)
    │   ├── page.tsx                ← root redirect
    │   ├── (auth)/
    │   │   ├── login/page.tsx
    │   │   ├── onboarding/page.tsx
    │   │   └── reset-password/page.tsx
    │   └── (app)/
    │       ├── layout.tsx          ← Navbar + Toaster wrapper
    │       ├── home/page.tsx       ← dashboard
    │       ├── admin/clients/page.tsx
    │       └── teams/[teamId]/
    │           ├── board/page.tsx  ← Kanban board (DnD)
    │           ├── list/page.tsx   ← List view (paginated)
    │           ├── members/page.tsx
    │           └── settings/page.tsx
    ├── components/
    │   ├── TaskDetailPanel.tsx     ← slide-over panel for task detail
    │   ├── ThemeProvider.tsx
    │   ├── layout/Navbar.tsx
    │   └── ui/ (button, dropdown-menu)
    ├── context/AuthContext.tsx     ← auth state, login/logout
    ├── hooks/useApi.ts             ← useBoard, useTaskDetail, useTeamMembers, etc.
    ├── lib/
    │   ├── api.ts                  ← axios instance (baseURL: /api, JWT interceptor)
    │   └── constants.ts
    ├── types/index.ts              ← all shared TS types (TaskCard, BoardColumn, etc.)
    └── middleware.ts               ← route protection (redirects unauthenticated)
```

---

## Data Models (backend/accounts/models.py)

| Model | Key Fields |
|-------|-----------|
| `User` | `id` (UUID), `email`, `email_secondary`, `full_name`, `role` (`super_admin`/`admin`/`employee`), `is_active`, `avatar_url` |
| `Team` | `id`, `name`, `color`, `icon`, `created_by` |
| `TeamMember` | `team`, `user`, `team_role` (`dept_head`/`employee`) |
| `BoardColumn` | `team`, `name`, `color`, `position` |
| `Task` | `id` (UUID), `team`, `column`, `title`, `description`, `priority` (`critical`/`high`/`medium`/`low`), `position` (float), `due_date`, `created_by` |
| `TaskAssignee` | `task`, `user` |
| `AuditLog` | `team`, `user`, `action`, `entity_type`, `entity_id`, `metadata` (JSON), `timestamp` |
| `InviteCode` | `code`, `created_by`, `is_active`, `used_by`, `used_at` |

---

## API Routes (all under `/api/`)

### Auth
- `POST /api/auth/login/` — returns `access` + `refresh` tokens
- `POST /api/auth/token/refresh/`
- `POST /api/auth/logout/`
- `POST /api/auth/onboarding/` — set full_name + password on first login
- `POST /api/auth/reset-password/`

### Users / Admin
- `GET /api/users/me/` — current user profile
- `PATCH /api/users/me/` — update profile
- `GET /api/admin/users/` — list all users (admin only)
- `POST /api/admin/invite-codes/` — generate invite code
- `GET /api/admin/invite-codes/` — list invite codes

### Teams
- `GET /api/teams/` — teams visible to current user
- `POST /api/teams/` — create team (admin only)
- `GET /api/teams/{id}/` — team detail
- `PATCH /api/teams/{id}/` — update team (admin/dept_head)
- `DELETE /api/teams/{id}/` — delete team (admin only)

### Team Members
- `GET /api/teams/{id}/members/` — list members
- `POST /api/teams/{id}/members/` — add member (admin/dept_head)
- `DELETE /api/teams/{id}/members/{userId}/` — remove member
- `PATCH /api/teams/{id}/members/{userId}/role/` — change role

### Board & Tasks
- `GET /api/teams/{id}/board/` — full board (columns + tasks + assignees)
- `POST /api/teams/{id}/tasks/` — create task
- `GET /api/teams/{id}/tasks/` — list tasks (paginated, filterable, sortable)
  - Query params: `priority`, `assignee`, `search`, `sort`, `page`, `page_size`
- `GET /api/teams/{id}/tasks/{taskId}/` — task detail
- `PATCH /api/teams/{id}/tasks/{taskId}/` — update task
- `DELETE /api/teams/{id}/tasks/{taskId}/` — delete task
- `POST /api/teams/{id}/tasks/{taskId}/move/` — move task (column + position)
- `POST /api/teams/{id}/tasks/{taskId}/assignees/` — add assignee
- `DELETE /api/teams/{id}/tasks/{taskId}/assignees/{userId}/` — remove assignee

### Activity
- `GET /api/teams/{id}/activity/` — team activity feed (role-scoped)

---

## Permissions Model

```
super_admin  → sees all teams, can do everything
admin        → sees all teams, manages members/tasks
dept_head    → sees their teams, manages members/tasks within their teams
employee     → sees only their teams, read + task creation (if permitted)
```

- `canManage = isAdmin || isDeptHead` checked on frontend for gating UI actions
- Backend: `permissions.py` has `IsAdminOrDeptHead`, `IsTeamMember`, etc.

---

## Frontend Patterns

### Auth
- `AuthContext` stores `user` + `tokens`, handles `login()`, `logout()`, `refreshToken()`
- `middleware.ts` redirects unauthenticated users to `/login`
- Axios interceptor in `lib/api.ts` attaches `Authorization: Bearer <token>` and auto-refreshes on 401

### API Hooks (`hooks/useApi.ts`)
- `useBoard(teamId)` → `board`, `fetchBoard`, `createTask`, `updateTask`, `deleteTask`, `moveTask`, `addAssignee`, `removeAssignee`
- `useTaskDetail(teamId)` → `task`, `fetchTask`, `clearTask`
- `useTeamMembers(teamId)` → `members`, `fetchMembers`, `addMember`, `removeMember`, `changeRole`

### Toast Pattern (sonner)
```tsx
// Loading → success/error
const toastId = toast.loading("Saving…");
const result = await someAction();
if (result.success) toast.success("Done!", { id: toastId });
else toast.error(result.error || "Failed.", { id: toastId });

// Confirmation with action buttons
toast("Delete this task?", {
  description: "This action cannot be undone.",
  action: { label: "Delete", onClick: async () => { /* ... */ } },
  cancel: { label: "Cancel", onClick: () => {} },
});
```

### Navigation (smooth tab switching)
```tsx
const [, startTransition] = useTransition();
// Wrap route changes to prevent flash:
onClick={() => startTransition(() => router.push(`/teams/${teamId}/list`))}
```
Root div on each page uses `animate-in fade-in duration-150` for smooth entry.

### Design System
- Colors: CSS vars (`--background`, `--foreground`, `--primary`, `--card`, `--border`, `--muted-foreground`, `--secondary`, `--destructive`)
- Dark/light mode via `ThemeProvider` + `suppressHydrationWarning` on `<html>`
- Priority badges: `critical` (red), `high` (orange), `medium` (yellow), `low` (green)
- `PRIORITY_CONFIG` object used on both board and list pages

---

## What's Been Built (Phase 1 → Phase 3)

### Phase 1: Foundation
- Django project setup, JWT auth, User model with roles
- Onboarding flow (first login → set name + password)
- Invite code system (admin generates codes for new users)
- Next.js 15 app with App Router, auth context, protected routes

### Phase 2: Teams + Board
- Team model, creation (admin only), listing (role-scoped)
- Team members: add, remove, change role (dept_head/employee)
- Kanban board: BoardColumn + Task models, full CRUD
- Board UI: drag-and-drop columns with `@dnd-kit`, task cards with priority badges
- Task detail slide-over panel (`TaskDetailPanel.tsx`)

### Phase 3: List View + Polish
- List view page (`/teams/[teamId]/list`) — paginated table, 25 tasks/page
  - Server-side filtering: priority, assignee, search, sort
  - Pagination controls (first/prev/page numbers/next/last)
  - Row selection with bulk action foundation
- Board ↔ List tab switching (smooth with `useTransition` + `animate-in`)
- "New Task" modal: both board and list share the same design
  - Large title input, description with formatting toolbar (Bold/Italic/ListOrdered/Link — UI only, not wired to rich text)
  - Assignee avatar picker (inline +button → dropdown of members)
  - Status (column) dropdown, due date picker
  - Priority pill buttons
- Rich toasts (sonner):
  - Task delete: confirmation toast with Delete/Cancel action buttons
  - Member remove: custom confirm dialog modal (destructive action)
  - Role change: loading → success/error toast
  - Add member: success toast
- AuditLog signals on task/member events
- Team settings page (`/teams/[teamId]/settings`)
- Team members page (`/teams/[teamId]/members`)
- Admin clients page (`/admin/clients`)
- Navbar with theme toggle, user menu, team navigation
- Various bug fixes: dept_head visibility, 403 on member ops, admin filtering

---

## Phase 4 Implementation Checklist

See `Zuvo-Phase4-CommentsActivity.md` for full spec.

### Backend Steps

- [x] **Step 0A — Bulk Task Operations (P3 Patch)**
  - [x] Add `BulkTaskActionSerializer` to `serializers.py`
  - [x] Add `BulkTaskActionView` to `views.py` (change_status, change_priority, assign, unassign, delete)
  - [x] Add URL route: `teams/<uuid:team_id>/tasks/bulk/`
  - [x] Add `bulkAction` to `useBoard` hook in frontend (Step 7)

- [x] **Step 1 — Comment + UserTeamView Models**
  - [x] Add `Comment` model to `models.py` (UUID pk, task FK, user FK, content, is_system, edited_at, deleted_at, created_at)
  - [x] Add `UserTeamView` model to `models.py` (UUID pk, user FK, team FK, last_viewed_at, unique constraint)
  - [x] Add 3 new AuditLog actions: `COMMENT_ADDED`, `COMMENT_EDITED`, `COMMENT_DELETED`
  - [x] Run `makemigrations` + `migrate` (migration 0006 applied)

- [x] **Step 2 — Comment Serializers**
  - [x] Add `CommentSerializer` (output: user, content, is_system, is_edited, is_deleted, mentions via regex)
  - [x] Add `CreateCommentSerializer` (input: content, max 5000 chars)
  - [x] Add `EditCommentSerializer` (input: content, max 5000 chars)
  - [x] Update model imports at top of `serializers.py`

- [x] **Step 3 — Comment Views + System Comments**
  - [x] Add `create_system_comment()` helper function
  - [x] Add `CommentListCreateView` (GET list + POST create)
  - [x] Add `CommentDetailView` (PATCH edit + DELETE soft-delete)
  - [x] Wire system comments into `TaskMoveView.post()` (status change)
  - [x] Wire system comments into `TaskDetailView.patch()` (priority change)
  - [x] Wire system comments into `TaskAssigneeView.post()` (assign)
  - [x] Wire system comments into `TaskAssigneeView.delete()` (unassign)
  - [x] Update view imports for `Comment`, `UserTeamView`, `timedelta`

- [x] **Step 4 — Activity Feed View**
  - [x] Add `ActivityFeedView` (GET `/api/activity/feed/`, role-scoped, cursor pagination, date grouping)
  - [x] Add `_build_activity_text()` helper for human-readable activity strings
  - [x] Update ALL existing `log_action()` calls to include `"team_id": str(team.id)` in metadata
  - [x] Replaced old `RecentActivityView` with `ActivityFeedView`

- [x] **Step 5 — Unread Tracking Views**
  - [x] Add `MarkTeamViewedView` (POST `/api/teams/{id}/viewed/`)
  - [x] Add `UnreadCountsView` (GET `/api/teams/unread-counts/`)
  - [x] Enhanced `BoardView.get()` with `is_unread` flag per task + `last_viewed_at` + real comment counts

- [x] **Step 6 — URL Routes**
  - [x] Add bulk task route
  - [x] Add comment routes (list/create + detail)
  - [x] Add activity feed route
  - [x] Add unread tracking routes (viewed + unread-counts)
  - [x] Removed old `activity/recent/` route

### Frontend Steps

- [x] **Step 7 — Types + Hooks**
  - [x] Add `CommentInfo` interface to `types/index.ts`
  - [x] Add `ActivityEntry` interface to `types/index.ts` (replaced old local one in hooks)
  - [x] Add `UnreadCounts` interface to `types/index.ts`
  - [x] Add `is_unread` field to `TaskCard` in `types/index.ts`
  - [x] Add `last_viewed_at` to `BoardData` in `types/index.ts`
  - [x] Add `useComments(teamId, taskId)` hook to `useApi.ts`
  - [x] Add `useActivityFeed()` hook to `useApi.ts` (with groupedActivities, loadMore, cursor pagination)
  - [x] Add `useUnreadCounts()` hook to `useApi.ts` (fetchUnreadCounts, markTeamViewed)
  - [x] Add `bulkAction` to existing `useBoard` hook return
  - [x] Add `clearUnreadFlags` to `useBoard` hook return
  - [x] Replace `useRecentActivity` with `useActivityFeed` (backward-compat stub removed)
  - [x] Add `useMemo` to React imports

- [x] **Step 8 — Comments Section in TaskDetailPanel**
  - [x] Add `teamId` prop to `TaskDetailPanel`
  - [x] Integrate `useComments` hook (fetches on task open)
  - [x] Build comment list UI (user comments as chat bubbles, system comments as `Zap` icon rows)
  - [x] Comment input with @mention support (dropdown of team members, `@[uuid]` format)
  - [x] Edit comment inline (pencil icon, 24h window, textarea swap)
  - [x] Delete comment (trash icon, soft delete, author + admin/dept_head)
  - [x] Empty state: "No comments yet. Be the first to add one."
  - [x] Loading skeleton state (CommentSkeleton)
  - [x] Update board + list pages to pass `teamId` to TaskDetailPanel

- [x] **Step 9 — Home Page Activity Feed**
  - [x] Replace old activity feed with `useActivityFeed()` + `useUnreadCounts()`
  - [x] Grouped display: Today / Yesterday / This Week / Older (DateGroupLabel dividers)
  - [x] Activity entry rows: action icon, user_name, activity_text, relative time, team badge
  - [x] Action-type icons (task=Plus/MoveRight, comment=MessageCircle, member=UserPlus2, team=Building2)
  - [x] Color-coded left border (blue=task, green=comment, orange=member, coral=team)
  - [x] "Load more" button with cursor pagination
  - [x] Unread badges on team cards ("3 new" coral badge, animate-in)
  - [x] `markTeamViewed` on team card click (navigateToTeamBoard)

- [x] **Step 10 — Board Unread Indicators**
  - [x] Blue pulse dot (8px, animate-ping) on task cards where `is_unread === true`
  - [x] Unread count badge on column headers ("N new" blue pill)
  - [x] "Mark all read" button in board sub-header (only visible when totalUnread > 0)
  - [x] Auto-mark viewed on board load (`useEffect` on mount)
  - [x] Auto-mark viewed every 60s interval
  - [x] `clearUnreadFlags()` called on "mark all read" button click

### Conflict Notes
- Phase 4 doc references `company=user.company` and `is_archived` on Team — both exist in current models
- Phase 4 doc references `assigned_by` on TaskAssignee — exists in current model
- `log_action()` helper used throughout — verify it exists in `utils.py`
- `RecentActivityView` may or may not exist in current views — check before replacing
- Migration will be 0006 (0001–0005 already applied)
- Frontend: `TaskDetailPanel` needs a new `teamId` prop — must update all call sites (board + list pages)

---

## Known Patterns / Gotchas

- **`h-screen` layout**: Board and list pages use `h-screen flex flex-col overflow-hidden` on the root div to prevent double scrollbars. The Navbar is in the parent `(app)/layout.tsx`, so pages must account for navbar height.
- **`sonner` Toaster**: Already added to `(app)/layout.tsx`. Do not add another one.
- **Position float**: Tasks use a float `position` field for ordering. New tasks get `last.position + 1.0`; drag-drop uses midpoint between neighbors.
- **`canManage` gate**: Both board and list pages compute `canManage = isAdmin || isDeptHead`. Only `canManage` users see "New Task" button and member management.
- **Task list endpoint**: `GET /api/teams/{id}/tasks/` returns `{ tasks: [], total: int }`. Board endpoint `GET /api/teams/{id}/board/` returns full columns with nested tasks.
- **Migration state**: Migrations 0001–0005 are applied. When adding new models/fields, create a new migration (0006+).
- **`Bold/Italic/ListOrdered/Link` toolbar**: Rendered in the create task modal as UI only — not wired to actual rich text editing yet.
