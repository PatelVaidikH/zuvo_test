import { useState, useCallback, useMemo } from "react";
import api from "@/lib/api";
import type {
  Company,
  CompanyListResponse,
  CompanyUsersResponse,
  CreateCompanyFormData,
  UpdateCompanyFormData,
  CreateUserFormData,
  CreateUserResponse,
  UpdateUserFormData,
  CompanyUser,
  User,
  Team,
  TeamDetail,
  TeamMemberInfo,
  CreateTeamData,
  UpdateTeamData,
  AddMemberData,
  InviteMemberData,
  InviteMemberResponse,
  BoardData, BoardColumn, TaskCard, TaskDetail,
  CreateTaskData, UpdateTaskData, MoveTaskData,
  TaskAssigneeInfo,
  CommentInfo,
  ActivityEntry,
  UnreadCounts,
} from "@/types";

// ── Company CRUD Hook ──
export function useClients() {
  const [clients, setClients] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  const fetchClients = useCallback(
    async (search?: string, statusFilter?: string) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);
        const response = await api.get<CompanyListResponse>(
          `/admin/clients/?${params}`,
        );
        setClients(response.data.results);
        setTotalCount(response.data.count);
      } catch (err: any) {
        setError(err.response?.data?.error || "Failed to fetch clients.");
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const createClient = async (data: CreateCompanyFormData) => {
    try {
      const response = await api.post<Company>("/admin/clients/", data);
      setClients((prev) => [response.data, ...prev]);
      setTotalCount((prev) => prev + 1);
      return { success: true, company: response.data };
    } catch (err: any) {
      return {
        success: false,
        error:
          err.response?.data?.errors?.name?.[0] || "Failed to create client.",
      };
    }
  };

  const updateClient = async (id: string, data: UpdateCompanyFormData) => {
    try {
      const response = await api.patch<Company>(`/admin/clients/${id}/`, data);
      setClients((prev) => prev.map((c) => (c.id === id ? response.data : c)));
      return { success: true, company: response.data };
    } catch (err: any) {
      return { success: false, error: "Failed to update client." };
    }
  };

  const deactivateClient = async (id: string) => {
    try {
      await api.delete(`/admin/clients/${id}/`);
      setClients((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: false } : c)),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Failed to deactivate." };
    }
  };

  return {
    clients,
    isLoading,
    error,
    totalCount,
    fetchClients,
    createClient,
    updateClient,
    deactivateClient,
  };
}

// ── Company Users CRUD Hook ──
export function useClientUsers(companyId: string) {
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [company, setCompany] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(
    async (search?: string) => {
      if (!companyId) return;
      setIsLoading(true);
      setError(null);
      try {
        const params = search ? `?search=${search}` : "";
        const response = await api.get<CompanyUsersResponse>(
          `/admin/clients/${companyId}/users/${params}`,
        );
        setUsers(response.data.results);
        setCompany(response.data.company);
      } catch {
        setError("Failed to fetch users.");
      } finally {
        setIsLoading(false);
      }
    },
    [companyId],
  );

  const createUser = async (data: CreateUserFormData) => {
    try {
      const response = await api.post<CreateUserResponse>(
        `/admin/clients/${companyId}/users/`,
        data,
      );
      setUsers((prev) => [response.data.user, ...prev]);
      return { success: true, result: response.data };
    } catch (err: any) {
      return {
        success: false,
        error:
          err.response?.data?.errors?.email?.[0] || "Failed to create user.",
      };
    }
  };

  const updateUser = async (userId: string, data: UpdateUserFormData) => {
    try {
      const response = await api.patch<CompanyUser>(
        `/admin/clients/${companyId}/users/${userId}/`,
        data,
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? response.data : u)),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Failed to update user." };
    }
  };

  const deactivateUser = async (userId: string) => {
    try {
      await api.delete(`/admin/clients/${companyId}/users/${userId}/`);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: false } : u)),
      );
      return { success: true };
    } catch {
      return { success: false, error: "Failed to deactivate." };
    }
  };

  const resetUserPassword = async (userId: string) => {
    try {
      const response = await api.post<CreateUserResponse>(
        `/admin/clients/${companyId}/users/${userId}/reset-password/`,
      );
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, is_password_temp: true } : u,
        ),
      );
      return { success: true, result: response.data };
    } catch {
      return { success: false, error: "Failed to reset password." };
    }
  };

  return {
    users,
    company,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deactivateUser,
    resetUserPassword,
  };
}

// ══════════════════════════════════════════════════════
//  NEW: useTeams — for the Home Page
// ══════════════════════════════════════════════════════

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const fetchTeams = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/teams/");
      setTeams(res.data.teams);
      setTotalCount(res.data.count);
    } catch (err) {
      console.error("Failed to fetch teams:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTeam = useCallback(async (data: CreateTeamData) => {
    try {
      const res = await api.post("/teams/", data);
      setTeams((prev) => [res.data.team, ...prev]);
      setTotalCount((prev) => prev + 1);
      return { success: true, team: res.data.team as Team };
    } catch (err: any) {
      return {
        success: false,
        error:
          err.response?.data?.errors?.name?.[0] ||
          err.response?.data?.error ||
          "Failed to create team.",
      };
    }
  }, []);

  const updateTeam = useCallback(
    async (teamId: string, data: UpdateTeamData) => {
      try {
        const res = await api.patch(`/teams/${teamId}/`, data);
        setTeams((prev) =>
          prev.map((t) => (t.id === teamId ? { ...t, ...res.data.team } : t)),
        );
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error:
            err.response?.data?.errors?.name?.[0] ||
            err.response?.data?.error ||
            "Failed to update team.",
        };
      }
    },
    [],
  );

  const archiveTeam = useCallback(async (teamId: string) => {
    try {
      await api.delete(`/teams/${teamId}/`);
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
      setTotalCount((prev) => prev - 1);
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to archive team.",
      };
    }
  }, []);

  return {
    teams,
    isLoading,
    totalCount,
    fetchTeams,
    createTeam,
    updateTeam,
    archiveTeam,
  };
}

// ══════════════════════════════════════════════════════
//  NEW: useTeamMembers — for Team Members Page
// ══════════════════════════════════════════════════════

export function useTeamMembers(teamId: string) {
  const [members, setMembers] = useState<TeamMemberInfo[]>([]);
  const [teamName, setTeamName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/teams/${teamId}/members/`);
      setMembers(res.data.members);
      setTeamName(res.data.team_name);
    } catch (err) {
      console.error("Failed to fetch members:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const addMember = useCallback(
    async (data: AddMemberData) => {
      try {
        const res = await api.post(`/teams/${teamId}/members/`, data);
        setMembers((prev) => [...prev, res.data.member]);
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err.response?.data?.error || "Failed to add member.",
        };
      }
    },
    [teamId],
  );

  const addMembers = useCallback(
    async (items: { user_id: string; team_role: string }[]) => {
      try {
        const res = await api.post(`/teams/${teamId}/members/bulk/`, {
          members: items,
        });
        setMembers((prev) => [...prev, ...res.data.added]);
        return { success: true, skipped: res.data.skipped as string[] };
      } catch (err: any) {
        return {
          success: false,
          error: err.response?.data?.error || "Failed to add members.",
          skipped: [] as string[],
        };
      }
    },
    [teamId],
  );

  const inviteMember = useCallback(
    async (data: InviteMemberData) => {
      try {
        const res = await api.post(`/teams/${teamId}/members/invite/`, data);
        setMembers((prev) => [...prev, res.data.team_membership]);
        return {
          success: true,
          result: res.data as InviteMemberResponse,
        };
      } catch (err: any) {
        return {
          success: false,
          error:
            err.response?.data?.errors?.email?.[0] ||
            err.response?.data?.error ||
            "Failed to invite member.",
        };
      }
    },
    [teamId],
  );

  const changeRole = useCallback(
    async (userId: string, teamRole: string) => {
      try {
        const res = await api.patch(`/teams/${teamId}/members/${userId}/`, {
          team_role: teamRole,
        });
        setMembers((prev) =>
          prev.map((m) =>
            m.user.id === userId
              ? { ...m, team_role: res.data.member.team_role }
              : m,
          ),
        );
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err.response?.data?.error || "Failed to change role.",
        };
      }
    },
    [teamId],
  );

  const removeMember = useCallback(
    async (userId: string) => {
      try {
        await api.delete(`/teams/${teamId}/members/${userId}/`);
        setMembers((prev) => prev.filter((m) => m.user.id !== userId));
        return { success: true };
      } catch (err: any) {
        return {
          success: false,
          error: err.response?.data?.error || "Failed to remove member.",
        };
      }
    },
    [teamId],
  );

  return {
    members,
    teamName,
    isLoading,
    fetchMembers,
    addMember,
    addMembers,
    inviteMember,
    changeRole,
    removeMember,
  };
}

// ══════════════════════════════════════════════════════
//  NEW: useCompanyMembers — for the "Add Member" dropdown
// ══════════════════════════════════════════════════════

export function useCompanyMembers() {
  const [companyMembers, setCompanyMembers] = useState<User[]>([]);
  const [allMembers, setAllMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAll, setIsLoadingAll] = useState(false);

  const fetchCompanyMembers = useCallback(
    async (search?: string, excludeTeam?: string) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (excludeTeam) params.set("exclude_team", excludeTeam);

        const res = await api.get(`/company/members/?${params.toString()}`);
        setCompanyMembers(res.data.members);
      } catch (err) {
        console.error("Failed to fetch company members:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const fetchAllMembers = useCallback(async () => {
    setIsLoadingAll(true);
    try {
      const res = await api.get("/company/members/");
      setAllMembers(res.data.members);
    } catch (err) {
      console.error("Failed to fetch all members:", err);
    } finally {
      setIsLoadingAll(false);
    }
  }, []);

  const createCompanyMember = useCallback(
    async (
      data: import("@/types").CreateCompanyMemberFormData,
    ): Promise<{
      success: boolean;
      result?: import("@/types").CreateCompanyMemberResponse;
      error?: string;
    }> => {
      try {
        const res = await api.post("/company/members/", data);
        return { success: true, result: res.data };
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: { data?: { error?: string; detail?: string } };
        };
        const msg =
          axiosErr.response?.data?.error ||
          axiosErr.response?.data?.detail ||
          "Failed to create member.";
        return { success: false, error: msg };
      }
    },
    [],
  );

  return {
    companyMembers,
    allMembers,
    isLoading,
    isLoadingAll,
    fetchCompanyMembers,
    fetchAllMembers,
    createCompanyMember,
  };
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

  // Group activities by date (backend already sets date_group, we just bucket them)
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

// ══════════════════════════════════════════════════════
//  useBoard — for Kanban Board page
// ══════════════════════════════════════════════════════

export function useBoard(teamId: string) {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBoard = useCallback(async () => {
    if (!teamId) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/teams/${teamId}/board/`);
      setBoard(res.data);
    } catch (err) {
      console.error("Failed to fetch board:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const createTask = useCallback(async (data: CreateTaskData) => {
    try {
      const res = await api.post(`/teams/${teamId}/tasks/`, data);
      // Add task to the correct column in local state
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) =>
            col.id === res.data.task.column_id
              ? { ...col, tasks: [...col.tasks, res.data.task], task_count: col.task_count + 1 }
              : col
          ),
        };
      });
      return { success: true, task: res.data.task };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.errors?.title?.[0]
          || err.response?.data?.error
          || "Failed to create task.",
      };
    }
  }, [teamId]);

  const moveTask = useCallback(async (
    taskId: string,
    data: MoveTaskData,
    sourceColumnId: string,
  ) => {
    // Optimistic update — move task in UI immediately
    setBoard((prev) => {
      if (!prev) return prev;

      // Find the task in source column
      let movedTask: TaskCard | undefined;
      const newColumns = prev.columns.map((col) => {
        if (col.id === sourceColumnId) {
          movedTask = col.tasks.find((t) => t.id === taskId);
          return {
            ...col,
            tasks: col.tasks.filter((t) => t.id !== taskId),
            task_count: col.task_count - 1,
          };
        }
        return col;
      });

      if (!movedTask) return prev;

      // Add to target column at correct position
      const updatedTask = { ...movedTask, column_id: data.column_id, position: data.position };
      return {
        ...prev,
        columns: newColumns.map((col) =>
          col.id === data.column_id
            ? {
                ...col,
                tasks: [...col.tasks, updatedTask].sort((a, b) => a.position - b.position),
                task_count: col.task_count + 1,
              }
            : col
        ),
      };
    });

    // Send to server
    try {
      await api.post(`/teams/${teamId}/tasks/${taskId}/move/`, data);
      return { success: true };
    } catch (err: any) {
      // Revert on failure
      fetchBoard();
      return {
        success: false,
        error: err.response?.data?.error || "Failed to move task.",
      };
    }
  }, [teamId, fetchBoard]);

  const updateTask = useCallback(async (taskId: string, data: UpdateTaskData) => {
    try {
      const res = await api.patch(`/teams/${teamId}/tasks/${taskId}/`, data);
      // Update task in board state
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) =>
              t.id === taskId ? { ...t, ...res.data.task } : t
            ),
          })),
        };
      });
      return { success: true, task: res.data.task };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to update task.",
      };
    }
  }, [teamId]);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      await api.delete(`/teams/${teamId}/tasks/${taskId}/`);
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tasks: col.tasks.filter((t) => t.id !== taskId),
            task_count: col.tasks.some((t) => t.id === taskId)
              ? col.task_count - 1
              : col.task_count,
          })),
        };
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to delete task.",
      };
    }
  }, [teamId]);

  const addAssignee = useCallback(async (taskId: string, userId: string) => {
    try {
      const res = await api.post(
        `/teams/${teamId}/tasks/${taskId}/assignees/`,
        { user_id: userId }
      );
      // Update task assignees in board state
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) =>
              t.id === taskId
                ? { ...t, assignees: [...t.assignees, res.data.assignee] }
                : t
            ),
          })),
        };
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to add assignee.",
      };
    }
  }, [teamId]);

  const removeAssignee = useCallback(async (taskId: string, userId: string) => {
    try {
      await api.delete(
        `/teams/${teamId}/tasks/${taskId}/assignees/${userId}/`
      );
      setBoard((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          columns: prev.columns.map((col) => ({
            ...col,
            tasks: col.tasks.map((t) =>
              t.id === taskId
                ? { ...t, assignees: t.assignees.filter((a) => a.user.id !== userId) }
                : t
            ),
          })),
        };
      });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Failed to remove assignee.",
      };
    }
  }, [teamId]);

  const bulkAction = useCallback(async (
    taskIds: string[],
    action: "change_status" | "change_priority" | "assign" | "unassign" | "delete",
    value?: string,
  ) => {
    try {
      await api.post(`/teams/${teamId}/tasks/bulk/`, {
        task_ids: taskIds,
        action,
        value: value || "",
      });
      // Refresh board so changes reflect
      await fetchBoard();
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || "Bulk action failed.",
      };
    }
  }, [teamId, fetchBoard]);

  /** Optimistically clear all is_unread flags locally (after markTeamViewed) */
  const clearUnreadFlags = useCallback(() => {
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
  }, []);

  return {
    board, isLoading,
    fetchBoard, createTask, moveTask, updateTask, deleteTask,
    addAssignee, removeAssignee, bulkAction, clearUnreadFlags,
  };
}


// ══════════════════════════════════════════════════════
//  useTaskDetail — for Task Detail slide-over
// ══════════════════════════════════════════════════════

export function useTaskDetail(teamId: string) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchTask = useCallback(async (taskId: string) => {
    setIsLoading(true);
    try {
      const res = await api.get(`/teams/${teamId}/tasks/${taskId}/`);
      setTask(res.data.task);
    } catch (err) {
      console.error("Failed to fetch task:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId]);

  const clearTask = useCallback(() => {
    setTask(null);
  }, []);

  return { task, isLoading, fetchTask, clearTask };
}


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