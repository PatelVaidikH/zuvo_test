"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useBoard, useTaskDetail, useTeamMembers } from "@/hooks/useApi";
import api from "@/lib/api";
import type { TaskCard } from "@/types";
import TaskDetailPanel from "@/components/TaskDetailPanel";

import {
  Search,
  ChevronDown,
  Plus,
  MoreHorizontal,
  MessageSquare,
  X,
  Users,
  Settings,
  LayoutGrid,
  List,
  AlertTriangle,
  ArrowLeft,
  Folder,
  Megaphone,
  PenTool,
  Code,
  TrendingUp,
  Rocket,
  Lightbulb,
  Verified,
  Zap,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Bold,
  Italic,
  ListOrdered,
  Link,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ── Team icons (same as board page) ───────────────────────────────────────────
const TEAM_ICONS: { id: string; icon: React.ReactNode }[] = [
  { id: "campaign", icon: <Megaphone className="w-4 h-4" /> },
  { id: "design", icon: <PenTool className="w-4 h-4" /> },
  { id: "code", icon: <Code className="w-4 h-4" /> },
  { id: "settings", icon: <Settings className="w-4 h-4" /> },
  { id: "trending", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "rocket", icon: <Rocket className="w-4 h-4" /> },
  { id: "idea", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "verified", icon: <Verified className="w-4 h-4" /> },
  { id: "folder", icon: <Folder className="w-4 h-4" /> },
  { id: "grid", icon: <LayoutGrid className="w-4 h-4" /> },
  { id: "bolt", icon: <Zap className="w-4 h-4" /> },
  { id: "more", icon: <MoreHorizontal className="w-4 h-4" /> },
];

// ── Priority config ────────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  critical: {
    label: "Critical",
    badgeClass: "bg-red-100 text-red-700 border border-red-200",
    dotClass: "bg-red-500",
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-100 text-orange-700 border border-orange-200",
    dotClass: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-yellow-100 text-yellow-700 border border-yellow-200",
    dotClass: "bg-yellow-500",
  },
  low: {
    label: "Low",
    badgeClass: "bg-green-100 text-green-700 border border-green-200",
    dotClass: "bg-green-600",
  },
};

const PAGE_SIZE = 25;

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={24}
        height={24}
        className="w-6 h-6 rounded-full object-cover border-2 border-background ring-1 ring-border shrink-0"
      />
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-primary/20 text-primary font-bold text-[10px] flex items-center justify-center border-2 border-background ring-1 ring-border shrink-0">
      {getInitials(name)}
    </div>
  );
}

// ── Checkbox ───────────────────────────────────────────────────────────────────
function Checkbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0"
      style={{
        backgroundColor:
          checked || indeterminate ? "var(--primary)" : "transparent",
        borderColor:
          checked || indeterminate ? "var(--primary)" : "var(--border)",
      }}
    >
      {indeterminate && !checked ? (
        <span className="w-2 h-0.5 bg-white rounded-full" />
      ) : checked ? (
        <svg
          className="w-2.5 h-2.5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          viewBox="0 0 12 12"
        >
          <polyline points="2,6 5,9 10,3" />
        </svg>
      ) : null}
    </button>
  );
}

// ── Skeleton row ───────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="grid grid-cols-[48px_minmax(260px,2fr)_160px_130px_180px_150px] gap-4 px-6 py-4 border-b border-border/60 items-center animate-pulse">
      <div className="flex items-center justify-center">
        <div className="w-4 h-4 rounded bg-secondary" />
      </div>
      <div className="space-y-2">
        <div className="h-3.5 w-3/4 bg-secondary rounded" />
        <div className="h-3 w-2/5 bg-secondary rounded" />
      </div>
      <div className="h-6 w-28 bg-secondary rounded-md" />
      <div className="h-6 w-20 bg-secondary rounded-md" />
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-secondary" />
        <div className="h-3.5 w-24 bg-secondary rounded" />
      </div>
      <div className="h-3.5 w-24 bg-secondary rounded ml-auto" />
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ListViewPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [, startTransition] = useTransition();

  // ── Board (columns + task ops) ──
  const {
    board,
    fetchBoard,
    createTask,
    updateTask,
    deleteTask,
    addAssignee,
    removeAssignee,
  } = useBoard(teamId);

  // ── Task list state ──
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  // ── Row selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Filters ──
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("position");

  // ── Task detail ──
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const {
    task: selectedTask,
    isLoading: taskLoading,
    fetchTask,
    clearTask,
  } = useTaskDetail(teamId);
  const { members, fetchMembers } = useTeamMembers(teamId);

  // ── Create modal ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPriority, setCreatePriority] = useState("medium");
  const [createColumnId, setCreateColumnId] = useState("");
  const [createDueDate, setCreateDueDate] = useState("");
  const [createAssigneeIds, setCreateAssigneeIds] = useState<string[]>([]);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);

  // ── Permissions ──
  const isAdmin =
    user?.role === "admin" || user?.role === "super_admin";
  const isDeptHead = members.some(
    (m) => m.user.id === user?.id && m.team_role === "dept_head"
  );
  const canManage = isAdmin || isDeptHead;

  // ── Column name map ──
  const columnMap = Object.fromEntries(
    (board?.columns ?? []).map((c) => [
      c.id,
      { name: c.name, color: c.color },
    ])
  );

  // ── Debounce search ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ── Fetch tasks ──
  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterPriority.length > 0)
        params.set("priority", filterPriority.join(","));
      if (filterAssignee) params.set("assignee", filterAssignee);
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("sort", sortBy);
      params.set("page", String(page));
      params.set("page_size", String(PAGE_SIZE));

      const res = await api.get(
        `/teams/${teamId}/tasks/?${params.toString()}`
      );
      setTasks(res.data.tasks ?? []);
      setTotal(res.data.total ?? 0);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    } finally {
      setIsLoading(false);
    }
  }, [teamId, filterPriority, filterAssignee, debouncedSearch, sortBy, page]);

  // ── Initial fetch ──
  useEffect(() => {
    fetchBoard();
    fetchMembers();
  }, [fetchBoard, fetchMembers]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ── Task detail ──
  useEffect(() => {
    if (selectedTaskId) fetchTask(selectedTaskId);
    else clearTask();
  }, [selectedTaskId, fetchTask, clearTask]);

  // ── Helpers ──
  const isOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const hasFilters =
    filterPriority.length > 0 || !!filterAssignee || !!searchQuery;

  // ── Selection ──
  const allSelected =
    tasks.length > 0 && tasks.every((t) => selected.has(t.id));
  const someSelected = tasks.some((t) => selected.has(t.id)) && !allSelected;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(tasks.map((t) => t.id)));
    }
  };

  // ── Priority filter ──
  const togglePriorityFilter = (p: string) => {
    setFilterPriority((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
    setPage(1);
  };

  // ── Create task ──
  const openCreateModal = () => {
    setCreateTitle("");
    setCreateDescription("");
    setCreatePriority("medium");
    setCreateColumnId(board?.columns[0]?.id ?? "");
    setCreateDueDate("");
    setCreateAssigneeIds([]);
    setCreateError("");
    setShowAssigneePicker(false);
    setShowCreateModal(true);
  };

  const handleCreateTask = async () => {
    if (!createTitle.trim()) {
      setCreateError("Task title is required.");
      return;
    }
    setIsCreating(true);
    setCreateError("");
    const result = await createTask({
      title: createTitle.trim(),
      description: createDescription.trim(),
      priority: createPriority,
      column_id: createColumnId || board?.columns[0]?.id,
      due_date: createDueDate || null,
      assignee_ids: createAssigneeIds,
    });
    if (result.success) {
      setShowCreateModal(false);
      fetchTasks();
    } else {
      setCreateError(result.error || "Failed to create task.");
    }
    setIsCreating(false);
  };

  // ── Task operations for TaskDetailPanel ──
  const handleUpdateTask = async (
    taskId: string,
    data: Record<string, unknown>
  ) => {
    const result = await updateTask(taskId, data);
    if (result.success) {
      fetchTasks();
      if (selectedTaskId) fetchTask(selectedTaskId);
    }
    return result;
  };

  const handleDeleteTask = (taskId: string) => {
    toast("Delete this task?", {
      description: "This action cannot be undone.",
      action: {
        label: "Delete",
        onClick: async () => {
          const toastId = toast.loading("Deleting task…");
          const result = await deleteTask(taskId);
          if (result.success) {
            setSelectedTaskId(null);
            fetchTasks();
            toast.success("Task deleted", { id: toastId });
          } else {
            toast.error("Failed to delete task.", { id: toastId });
          }
        },
      },
      cancel: {
        label: "Cancel",
        onClick: () => {},
      },
    });
  };

  const handleAddAssignee = async (taskId: string, userId: string) => {
    const result = await addAssignee(taskId, userId);
    if (result.success) {
      fetchTasks();
      if (selectedTaskId) fetchTask(selectedTaskId);
    }
    return result;
  };

  const handleRemoveAssignee = async (taskId: string, userId: string) => {
    const result = await removeAssignee(taskId, userId);
    if (result.success) {
      fetchTasks();
      if (selectedTaskId) fetchTask(selectedTaskId);
    }
    return result;
  };

  // ── Pagination ──
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (page <= 3) {
      for (let i = 1; i <= maxVisible; i++) pages.push(i);
    } else if (page >= totalPages - 2) {
      for (let i = totalPages - maxVisible + 1; i <= totalPages; i++)
        pages.push(i);
    } else {
      for (let i = page - 2; i <= page + 2; i++) pages.push(i);
    }
    return pages;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background h-screen flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="shrink-0 px-6 py-3 border-b border-border bg-secondary/20 z-10">
        <div className="flex items-center justify-between gap-4">
          {/* Left: back + team icon/name + tabs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => router.push("/home")}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors shadow-sm shrink-0"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 min-w-0">
              {board && (
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white shadow-sm shrink-0"
                  style={{ backgroundColor: board.team_color || "#5F6F62" }}
                >
                  {TEAM_ICONS.find((i) => i.id === board.team_icon)?.icon || (
                    <Folder className="w-4 h-4" />
                  )}
                </div>
              )}
              <h1 className="text-base font-semibold text-foreground truncate">
                {board?.team_name ?? "Loading…"}
              </h1>
            </div>

            {/* Tab nav */}
            <nav className="hidden sm:flex items-center gap-1 bg-secondary/60 rounded-lg p-1 border border-border">
              <button
                onClick={() => startTransition(() => router.push(`/teams/${teamId}/board`))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Board
              </button>
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card shadow-sm text-xs font-semibold text-foreground border border-border">
                <List className="w-3.5 h-3.5 text-primary" />
                List
              </button>
            </nav>
          </div>

          {/* Right: filters + actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search tasks…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 bg-card rounded-lg border border-input shadow-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none text-xs text-foreground placeholder:text-muted-foreground w-40 transition-all"
              />
            </div>

            {/* Priority filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shadow-sm transition-all ${
                    filterPriority.length > 0
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-card border-input text-muted-foreground hover:text-foreground hover:border-primary/50"
                  }`}
                >
                  Priority
                  {filterPriority.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center font-bold">
                      {filterPriority.length}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-40 bg-card border-border rounded-xl shadow-lg py-1.5 p-1"
              >
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={filterPriority.includes(key)}
                    onCheckedChange={() => togglePriorityFilter(key)}
                    className="flex items-center gap-2 text-xs text-foreground focus:bg-secondary cursor-pointer rounded-lg py-1.5"
                  >
                    <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                    {cfg.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Assignee filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium shadow-sm transition-all ${
                    filterAssignee
                      ? "bg-primary/10 border-primary/50 text-primary"
                      : "bg-card border-input text-muted-foreground hover:text-foreground hover:border-primary/50"
                  }`}
                >
                  Assignee
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 max-h-56 overflow-y-auto bg-card border-border rounded-xl shadow-lg p-1"
              >
                <DropdownMenuItem
                  onClick={() => {
                    setFilterAssignee("");
                    setPage(1);
                  }}
                  className="flex items-center gap-2 text-xs text-muted-foreground focus:bg-secondary cursor-pointer rounded-lg py-1.5"
                >
                  All members
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.map((m) => (
                  <DropdownMenuItem
                    key={m.user.id}
                    onClick={() => {
                      setFilterAssignee(
                        filterAssignee === m.user.id ? "" : m.user.id
                      );
                      setPage(1);
                    }}
                    className="flex items-center gap-2 text-xs text-foreground focus:bg-secondary cursor-pointer rounded-lg py-1.5"
                  >
                    <Avatar
                      name={m.user.full_name}
                      avatarUrl={m.user.avatar_url}
                    />
                    <span className="flex-1 truncate">{m.user.full_name}</span>
                    {filterAssignee === m.user.id && (
                      <span className="text-primary shrink-0">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-sm transition-all">
                  Sort
                  <ChevronDown className="w-3 h-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-44 bg-card border-border rounded-xl shadow-lg p-1"
              >
                {[
                  { value: "position", label: "Default order" },
                  { value: "due_date", label: "Due date" },
                  { value: "priority", label: "Priority" },
                  { value: "created_at", label: "Date created" },
                  { value: "title", label: "Title (A–Z)" },
                ].map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value);
                      setPage(1);
                    }}
                    className="flex items-center justify-between text-xs text-foreground focus:bg-secondary cursor-pointer rounded-lg py-1.5 px-3"
                  >
                    {opt.label}
                    {sortBy === opt.value && (
                      <span className="text-primary font-bold">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Clear filters */}
            {hasFilters && (
              <button
                onClick={() => {
                  setFilterPriority([]);
                  setFilterAssignee("");
                  setSearchQuery("");
                  setPage(1);
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-border mx-1" />

            {/* Member avatars */}
            {members.length > 0 && (
              <div className="hidden md:flex -space-x-1.5">
                {members.slice(0, 3).map((m) => (
                  <Avatar
                    key={m.user.id}
                    name={m.user.full_name}
                    avatarUrl={m.user.avatar_url}
                  />
                ))}
                {members.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-background ring-1 ring-border">
                    +{members.length - 3}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={() => router.push(`/teams/${teamId}/members`)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-sm transition-colors"
              title="Members"
            >
              <Users className="w-4 h-4" />
            </button>

            <button
              onClick={() => router.push(`/teams/${teamId}/settings`)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50 shadow-sm transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {canManage && (
              <button
                onClick={openCreateModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Main table ─────────────────────────────────────────────────────── */}
      <main className="grow overflow-hidden flex flex-col px-6 py-5">
        <div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {/* ── Sticky table header ── */}
          <div className="grid grid-cols-[48px_minmax(260px,2fr)_160px_130px_180px_150px] gap-4 px-6 py-3.5 border-b border-border bg-secondary/30 items-center shrink-0">
            <div className="flex items-center justify-center">
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={toggleAll}
              />
            </div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Task
            </div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Status
            </div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Priority
            </div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Assignee
            </div>
            <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider text-right">
              Due Date
            </div>
          </div>

          {/* ── Scrollable rows ── */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <>
                {[...Array(10)].map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </>
            ) : tasks.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center justify-center h-full py-24 text-center">
                <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center mb-4">
                  <List className="w-7 h-7 text-muted-foreground/60" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">
                  No tasks found
                </p>
                <p className="text-xs text-muted-foreground mb-5 max-w-xs">
                  {hasFilters
                    ? "No tasks match your current filters. Try adjusting or clearing them."
                    : "This team has no tasks yet. Create your first one to get started."}
                </p>
                {hasFilters ? (
                  <button
                    onClick={() => {
                      setFilterPriority([]);
                      setFilterAssignee("");
                      setSearchQuery("");
                      setPage(1);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear filters
                  </button>
                ) : (
                  canManage && (
                    <button
                      onClick={openCreateModal}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Task
                    </button>
                  )
                )}
              </div>
            ) : (
              /* Task rows */
              tasks.map((task) => {
                const priority =
                  PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                const col = columnMap[task.column_id];
                const overdue = isOverdue(task.due_date);
                const isSelected = selected.has(task.id);

                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className={`grid grid-cols-[48px_minmax(260px,2fr)_160px_130px_180px_150px] gap-4 px-6 py-3.5 border-b border-border/60 items-center cursor-pointer group transition-colors ${
                      isSelected
                        ? "bg-primary/5"
                        : "hover:bg-secondary/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleSelect(task.id)}
                      />
                    </div>

                    {/* Task title + subtitle */}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate leading-snug">
                        {task.title}
                      </span>
                      <span className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                        {col?.name && (
                          <span className="truncate">{col.name}</span>
                        )}
                        {col?.name && task.comment_count > 0 && (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                        {task.comment_count > 0 && (
                          <span className="flex items-center gap-1 shrink-0">
                            <MessageSquare className="w-3 h-3" />
                            {task.comment_count}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Status (column name) */}
                    <div>
                      {col ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary/60 text-muted-foreground border border-border/60 max-w-35">
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{
                              backgroundColor: col.color || "#94A3B8",
                            }}
                          />
                          <span className="truncate">{col.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">
                          —
                        </span>
                      )}
                    </div>

                    {/* Priority */}
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${priority.badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${priority.dotClass}`}
                        />
                        {priority.label}
                      </span>
                    </div>

                    {/* Assignee */}
                    <div className="flex items-center gap-2 min-w-0">
                      {task.assignees.length === 0 ? (
                        <span className="text-xs text-muted-foreground/40 italic">
                          Unassigned
                        </span>
                      ) : task.assignees.length === 1 ? (
                        <>
                          <Avatar
                            name={task.assignees[0].user.full_name}
                            avatarUrl={task.assignees[0].user.avatar_url}
                          />
                          <span className="text-sm text-foreground truncate">
                            {task.assignees[0].user.full_name}
                          </span>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-1.5">
                            {task.assignees.slice(0, 3).map((a) => (
                              <Avatar
                                key={a.user.id}
                                name={a.user.full_name}
                                avatarUrl={a.user.avatar_url}
                              />
                            ))}
                            {task.assignees.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-background ring-1 ring-border">
                                +{task.assignees.length - 3}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {task.assignees.length} people
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Due date */}
                    <div className="text-right">
                      {task.due_date ? (
                        <span
                          className={`inline-flex items-center justify-end gap-1 text-sm font-medium ${
                            overdue
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {overdue ? (
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                          ) : (
                            <Calendar className="w-3 h-3 shrink-0" />
                          )}
                          {formatDate(task.due_date)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/30">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ── Pagination footer ── */}
          {!isLoading && total > 0 && (
            <div className="shrink-0 border-t border-border px-6 py-3 flex items-center justify-between bg-secondary/20">
              {/* Left: count info */}
              <p className="text-xs text-muted-foreground">
                Showing{" "}
                <span className="font-semibold text-foreground">
                  {from}–{to}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-foreground">{total}</span>{" "}
                {total === 1 ? "task" : "tasks"}
                {selected.size > 0 && (
                  <span className="ml-2 text-primary font-semibold">
                    · {selected.size} selected
                  </span>
                )}
              </p>

              {/* Right: page controls */}
              <div className="flex items-center gap-1">
                {/* First */}
                <button
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  title="First page"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                {/* Prev */}
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  title="Previous page"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page numbers */}
                <div className="flex items-center gap-0.5 mx-0.5">
                  {getPageNumbers().map((pageNum) => (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-medium transition-colors ${
                        pageNum === page
                          ? "bg-primary text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}
                </div>

                {/* Next */}
                <button
                  onClick={() =>
                    setPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={page === totalPages}
                  title="Next page"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Last */}
                <button
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                  title="Last page"
                  className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── Create Task Modal ───────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-[1px]">
          <div className="bg-card w-full max-w-2xl rounded-lg border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Title input */}
            <div className="px-8 pt-8 pb-4">
              <input
                autoFocus
                type="text"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTask()}
                placeholder="Task Title"
                className="w-full text-2xl font-bold text-foreground border-none p-0 placeholder:text-muted-foreground/40 focus:ring-0 focus:outline-none bg-transparent"
              />
            </div>

            {/* Description */}
            <div className="px-8 py-2">
              <div className="mb-2 flex items-center gap-4 text-muted-foreground border-b border-border/40 pb-2">
                <button className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50">
                  <Bold className="w-4 h-4" />
                </button>
                <button className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50">
                  <Italic className="w-4 h-4" />
                </button>
                <button className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50">
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50">
                  <Link className="w-4 h-4" />
                </button>
              </div>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Add a description..."
                className="w-full min-h-30 resize-none border-none p-0 text-foreground text-base leading-relaxed focus:ring-0 focus:outline-none bg-transparent placeholder:text-muted-foreground/60"
              />
            </div>

            {/* Fields row */}
            <div className="px-8 py-6 space-y-6">
              <div className="flex items-center gap-12">
                {/* Assignees */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Assignees
                  </label>
                  <div className="flex items-center gap-2 relative">
                    <button
                      onClick={() => setShowAssigneePicker((p) => !p)}
                      className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    {createAssigneeIds.map((uid) => {
                      const member = members.find((m) => m.user.id === uid);
                      if (!member) return null;
                      return (
                        <button
                          key={uid}
                          onClick={() =>
                            setCreateAssigneeIds((prev) =>
                              prev.filter((id) => id !== uid),
                            )
                          }
                          className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-foreground border border-card ring-1 ring-border hover:ring-destructive transition-colors"
                          title={`Remove ${member.user.full_name}`}
                        >
                          {getInitials(member.user.full_name)}
                        </button>
                      );
                    })}
                    {showAssigneePicker && (
                      <div className="absolute top-full mt-1 left-0 z-50 bg-card border border-border rounded-xl shadow-lg py-1.5 w-48 max-h-48 overflow-y-auto">
                        {members
                          .filter((m) => !createAssigneeIds.includes(m.user.id))
                          .map((m) => (
                            <button
                              key={m.user.id}
                              onClick={() => {
                                setCreateAssigneeIds((prev) => [
                                  ...prev,
                                  m.user.id,
                                ]);
                                setShowAssigneePicker(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary/70 transition-colors"
                            >
                              <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-bold text-foreground">
                                {getInitials(m.user.full_name)}
                              </div>
                              <span className="truncate">
                                {m.user.full_name}
                              </span>
                            </button>
                          ))}
                        {members.filter(
                          (m) => !createAssigneeIds.includes(m.user.id),
                        ).length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">
                            All members added
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status / Column */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </label>
                  <div className="relative">
                    <select
                      value={createColumnId}
                      onChange={(e) => setCreateColumnId(e.target.value)}
                      className="appearance-none bg-card border border-input text-foreground text-sm rounded-lg px-3 py-1.5 pr-8 focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-secondary/30 transition-colors shadow-sm"
                    >
                      {board?.columns.map((col) => (
                        <option key={col.id} value={col.id}>
                          {col.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {/* Due date */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={createDueDate}
                      onChange={(e) => setCreateDueDate(e.target.value)}
                      className="bg-card border border-input text-foreground text-sm rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer hover:bg-secondary/30 transition-colors shadow-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Priority */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Priority
                </label>
                <div className="flex items-center gap-3">
                  {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setCreatePriority(key)}
                      className={`px-3 py-1 rounded-lg border text-xs font-medium transition-all ${
                        createPriority === key
                          ? "border-primary text-primary bg-primary/5"
                          : "border-border text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Error */}
            {createError && (
              <div className="px-8 pb-2">
                <p className="text-sm text-destructive">{createError}</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-8 py-5 bg-secondary/30 border-t border-border flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setShowAssigneePicker(false);
                }}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTask}
                disabled={isCreating || !createTitle.trim()}
                className="px-6 py-2 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg shadow-sm transition-all hover:shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Create Task
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Detail Panel ───────────────────────────────────────────────── */}
      {selectedTaskId && (
        <TaskDetailPanel
          teamId={teamId}
          task={selectedTask}
          isLoading={taskLoading}
          members={members}
          canManage={canManage}
          columns={
            board?.columns.map((c) => ({ id: c.id, name: c.name })) ?? []
          }
          currentUser={user ?? undefined}
          onClose={() => setSelectedTaskId(null)}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
          onAddAssignee={handleAddAssignee}
          onRemoveAssignee={handleRemoveAssignee}
        />
      )}
    </div>
  );
}
