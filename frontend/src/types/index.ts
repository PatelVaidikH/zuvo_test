// -User Roles- //
export type UserRole = "super_admin" | "admin" | "dept_head" | "employee";

// -User(what the API returns)- //
export interface User {
  id: string;
  email: string;
  full_name: string;
  contact_number: string;
  avatar_url: string | null;
  role: UserRole;
  job_title: string;
  comapany: string | null;
  company_name: string | null;
  is_password_temp: boolean;
  is_onboarded: boolean;
  timezone: string;
  last_login: string;
  created_at: string;
}

// -Auth Responses- //
export interface LoginResponse {
  access: string;
  refresh: string;
  user: User;
  requires_password_change: boolean;
  requires_onboarding: boolean;
}

export interface TempPasswordLoginResponse {
  requires_password_change: true;
  temp_token: string;
  message: string;
}

export interface SetPasswordResponse {
  access: string;
  refresh: string;
  user: User;
  requires_onboarding: boolean;
  message: string;
}

// ── Company ──
export interface Company {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  is_active: boolean;
  user_count: number;
  admin_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CompanyListResponse {
  count: number;
  results: Company[];
}

// ── Company User ──
export interface CompanyUser {
  id: string;
  full_name: string;
  email: string;
  email_secondary: string | null;
  contact_number: string;
  role: UserRole;
  job_title: string;
  avatar_url: string | null;
  is_active: boolean;
  is_password_temp: boolean;
  is_onboarded: boolean;
  last_login: string | null;
  created_at: string;
}

export interface CompanyUsersResponse {
  count: number;
  company: Company;
  results: CompanyUser[];
}

export interface CreateUserResponse {
  user: CompanyUser;
  credentials: {
    username: string;
    temporary_password: string;
  };
  message: string;
}

// ── Form Inputs ──
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SetPasswordFormData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface CreateCompanyFormData {
  name: string;
  description: string;
}

export interface CreateUserFormData {
  full_name: string;
  email: string;
  contact_number: string;
  role: "admin" | "dept_head";
  email_secondary?: string;
}

export interface UpdateCompanyFormData {
  name?: string;
  description?: string;
}

export interface UpdateUserFormData {
  full_name?: string;
  contact_number?: string;
  role?: UserRole;
  email_secondary?: string;
  is_active?: boolean;
}

export interface ApiError {
  errors?: Record<string, string[]>;
  error?: string;
  detail?: string;
}

// ── Onboarding ──
export interface NotificationPreferences {
  task_assigned: boolean;
  mentioned: boolean;
  deadline_approaching: boolean;
  status_changes: boolean;
  new_team_member: boolean;
}

export interface OnboardingFormData {
  full_name: string;
  job_title: string;
  timezone: string;
  avatar_url?: string | null;
  notification_preferences: NotificationPreferences;
}

// ── Teams ──

export interface Team {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  member_count: number;
  is_archived: boolean;
  created_at: string;
}

export interface TeamDetail extends Team {
  members: TeamMemberInfo[];
  created_by: User;
  updated_at: string;
}

export interface TeamMemberInfo {
  id: string; // membership ID
  user: User;
  team_role: "dept_head" | "employee";
  joined_at: string;
}

export interface CreateTeamData {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface AddMemberData {
  user_id: string;
  team_role: "dept_head" | "employee";
}

export interface InviteMemberData {
  full_name: string;
  email: string;
  contact_number?: string;
  role: "dept_head" | "employee";
  team_role: "dept_head" | "employee";
  email_secondary?: string;
}

export interface InviteMemberResponse {
  user: User;
  credentials: {
    username: string;
    temporary_password: string;
  };
  team_membership: TeamMemberInfo;
  message: string;
}

export interface CreateCompanyMemberFormData {
  full_name: string;
  email: string;
  contact_number?: string;
  role: "dept_head" | "employee";
  email_secondary?: string;
}

export interface CreateCompanyMemberResponse {
  user: User;
  credentials: {
    username: string;
    temporary_password: string;
  };
  message: string;
}

// ── Board & Tasks ──

export interface BoardColumn {
  id: string;
  name: string;
  position: number;
  color: string;
  is_default: boolean;
  task_count: number;
  tasks: TaskCard[];
}

export interface TaskCard {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  column_id: string;
  position: number;
  due_date: string | null;
  assignees: TaskAssigneeInfo[];
  comment_count: number;
  is_unread: boolean;
  created_by: User;
  created_at: string;
  updated_at: string;
}

export interface TaskDetail extends TaskCard {
  description: string;
  column_name: string;
}

export interface TaskAssigneeInfo {
  id: string;
  user: User;
  assigned_at: string;
}

export interface CreateTaskData {
  title: string;
  description?: string;
  priority?: string;
  column_id?: string;
  due_date?: string | null;
  assignee_ids?: string[];
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  priority?: string;
  due_date?: string | null;
}

export interface MoveTaskData {
  column_id: string;
  position: number;
}

export interface BoardData {
  team_id: string;
  team_name: string;
  team_icon: string;
  team_color: string;
  columns: BoardColumn[];
  last_viewed_at: string | null;
}

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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