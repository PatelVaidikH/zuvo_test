"use client";

import { useEffect, useState, useTransition, useRef } from "react";
import { toast } from "sonner";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useBoard, useTaskDetail, useTeamMembers, useUnreadCounts } from "@/hooks/useApi";
import type { TaskCard, BoardColumn } from "@/types";
import TaskDetailPanel from "@/components/TaskDetailPanel";

import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  Search,
  ChevronDown,
  Plus,
  MoreHorizontal,
  MessageSquare,
  Clock,
  CheckCircle2,
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
  Bold,
  Italic,
  ListOrdered,
  Link,
  EyeOff,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

// ── Team icons (same as home page) ────────────────────────────────────────────
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

// ── Priority config ───────────────────────────────────────────────────────────
const PRIORITY_CONFIG: Record<
  string,
  { label: string; badgeClass: string; dotClass: string }
> = {
  critical: {
    label: "Critical",
    badgeClass: "bg-red-100 text-red-700",
    dotClass: "bg-red-500",
  },
  high: {
    label: "High",
    badgeClass: "bg-orange-100 text-orange-700",
    dotClass: "bg-orange-500",
  },
  medium: {
    label: "Medium",
    badgeClass: "bg-yellow-100 text-yellow-700",
    dotClass: "bg-yellow-500",
  },
  low: {
    label: "Low",
    badgeClass: "bg-green-100 text-green-700",
    dotClass: "bg-green-600",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── Assignee Avatar ───────────────────────────────────────────────────────────
function Avatar({
  name,
  avatarUrl,
  size = "sm",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "xs";
}) {
  const sizeClass =
    size === "sm" ? "w-6 h-6 text-[10px]" : "w-5 h-5 text-[9px]";
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={24}
        height={24}
        className={`${sizeClass} rounded-full object-cover border-2 border-background ring-1 ring-border`}
      />
    );
  }
  return (
    <div
      className={`${sizeClass} rounded-full bg-primary/20 text-primary font-semibold flex items-center justify-center border-2 border-background ring-1 ring-border`}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Task Card (pure render) ───────────────────────────────────────────────────
function TaskCardView({
  task,
  isDone,
  isInProgress,
  isOverdue,
  onClick,
  isDragging = false,
}: {
  task: TaskCard;
  isDone: boolean;
  isInProgress: boolean;
  isOverdue: (d: string | null) => boolean;
  onClick?: () => void;
  isDragging?: boolean;
}) {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
  const overdue = isOverdue(task.due_date);

  return (
    <div
      onClick={onClick}
      className={[
        "bg-card rounded-xl border border-border p-3 cursor-pointer select-none shadow-sm relative",
        "hover:border-primary/40 hover:shadow-md transition-all duration-150",
        isDone ? "opacity-60 hover:opacity-100" : "",
        isInProgress ? "border-l-4 border-l-primary" : "",
        isDragging ? "shadow-xl scale-[1.02] rotate-1 opacity-90" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Unread indicator — blue pulse dot */}
      {task.is_unread && (
        <div className="absolute top-2 left-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
        </div>
      )}
      {/* Top row: priority badge + menu */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide ${
            isDone ? "bg-secondary text-muted-foreground" : priority.badgeClass
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isDone ? "bg-muted-foreground/60" : priority.dotClass
            }`}
          />
          {priority.label}
        </span>
        <button
          onClick={(e) => e.stopPropagation()}
          className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Title */}
      <p
        className={`text-sm font-medium leading-snug mb-3 ${
          isDone ? "line-through text-muted-foreground" : "text-foreground"
        }`}
      >
        {task.title}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/60 pt-2">
        {/* Left: due date + comment count */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {task.due_date && (
            <span
              className={`flex items-center gap-1 ${
                overdue ? "text-destructive font-medium" : ""
              }`}
            >
              {overdue ? (
                <AlertTriangle className="w-3 h-3" />
              ) : (
                <Clock className="w-3 h-3" />
              )}
              {formatDate(task.due_date)}
            </span>
          )}
          {task.comment_count > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {task.comment_count}
            </span>
          )}
        </div>

        {/* Right: assignee avatars or done check */}
        <div className="flex items-center gap-1">
          {isDone && (
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
          )}
          {task.assignees.length > 0 && (
            <div className="flex -space-x-1">
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar
                  key={a.user.id}
                  name={a.user.full_name}
                  avatarUrl={a.user.avatar_url}
                  size="sm"
                />
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-secondary text-muted-foreground text-[10px] font-semibold flex items-center justify-center border-2 border-background ring-1 ring-border">
                  +{task.assignees.length - 3}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sortable Task Card (dnd-kit wrapper) ──────────────────────────────────────
function SortableTaskCard({
  task,
  isDone,
  isInProgress,
  isOverdue,
  onClick,
}: {
  task: TaskCard;
  isDone: boolean;
  isInProgress: boolean;
  isOverdue: (d: string | null) => boolean;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group"
      {...attributes}
      {...listeners}
    >
      <TaskCardView
        task={task}
        isDone={isDone}
        isInProgress={isInProgress}
        isOverdue={isOverdue}
        onClick={onClick}
      />
    </div>
  );
}

// ── Droppable Column ──────────────────────────────────────────────────────────
function KanbanColumn({
  col,
  filteredTasks,
  openCreateModal,
  openTaskDetail,
  isOverdue,
  canManage,
}: {
  col: BoardColumn;
  filteredTasks: TaskCard[];
  openCreateModal: (columnId: string) => void;
  openTaskDetail: (taskId: string) => void;
  isOverdue: (d: string | null) => boolean;
  canManage: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  const isDone =
    col.name.toLowerCase() === "completed" || col.name.toLowerCase() === "done";
  const isInProgress = col.name.toLowerCase() === "in progress";
  const isCancelled = col.name.toLowerCase() === "cancelled";

  return (
    <div
      className={[
        "flex flex-col w-72 rounded-2xl border",
        isCancelled
          ? "border-dashed border-border bg-secondary/40"
          : "border-border bg-secondary/30",
        isOver ? "ring-2 ring-primary/30 bg-primary/5" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground truncate">
            {col.name}
          </span>
          <span className="ml-1 px-1.5 py-0.5 rounded-md bg-background border border-border text-[10px] font-medium text-muted-foreground">
            {filteredTasks.length}
          </span>
          {/* Unread count badge */}
          {filteredTasks.filter((t) => t.is_unread).length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
              {filteredTasks.filter((t) => t.is_unread).length} new
            </span>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => openCreateModal(col.id)}
            className="w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-primary transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-30"
      >
        <SortableContext
          items={filteredTasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {filteredTasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              isDone={isDone}
              isInProgress={isInProgress}
              isOverdue={isOverdue}
              onClick={() => openTaskDetail(task.id)}
            />
          ))}
        </SortableContext>

        {filteredTasks.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-8 h-8 rounded-full bg-border/40 flex items-center justify-center mb-2">
              <Plus className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No tasks</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton Board ────────────────────────────────────────────────────────────
function BoardSkeleton() {
  return (
    <div className="flex gap-4 min-w-max">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="w-72 rounded-2xl border border-border bg-secondary/30 animate-pulse"
        >
          <div className="px-4 py-3 border-b border-border/60">
            <div className="h-4 w-28 bg-border rounded" />
          </div>
          <div className="px-2 py-2 space-y-2">
            {[...Array(3)].map((_, j) => (
              <div
                key={j}
                className="bg-card rounded-xl border border-border p-3 shadow-sm"
              >
                <div className="h-3 w-16 bg-border rounded mb-2" />
                <div className="h-4 w-full bg-border rounded mb-1" />
                <div className="h-4 w-3/4 bg-border rounded mb-3" />
                <div className="h-3 w-full bg-border rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [, startTransition] = useTransition();

  const {
    board,
    isLoading,
    fetchBoard,
    createTask,
    moveTask,
    deleteTask,
    updateTask,
    addAssignee,
    removeAssignee,
    clearUnreadFlags,
  } = useBoard(teamId);

  const { markTeamViewed } = useUnreadCounts();

  const {
    task: selectedTask,
    isLoading: taskDetailLoading,
    fetchTask,
    clearTask,
  } = useTaskDetail(teamId);
  const { members, fetchMembers } = useTeamMembers(teamId);

  // ── Create Task Modal ──
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

  // ── Description formatting ──
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const handleFormat = (type: "bold" | "italic" | "list" | "link") => {
    const ta = descriptionRef.current;
    if (!ta) return;

    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const sel = createDescription.slice(start, end);
    const before = createDescription.slice(0, start);
    const after = createDescription.slice(end);

    let insert = "";
    let newSelStart = start;
    let newSelEnd = start;

    if (type === "bold") {
      const placeholder = sel || "bold text";
      insert = `**${placeholder}**`;
      newSelStart = start + 2;
      newSelEnd = start + 2 + placeholder.length;
    } else if (type === "italic") {
      const placeholder = sel || "italic text";
      insert = `*${placeholder}*`;
      newSelStart = start + 1;
      newSelEnd = start + 1 + placeholder.length;
    } else if (type === "list") {
      if (sel) {
        insert = sel
          .split("\n")
          .map((line, i) => `${i + 1}. ${line}`)
          .join("\n");
      } else {
        insert = "1. ";
      }
      newSelStart = start + insert.length;
      newSelEnd = newSelStart;
    } else if (type === "link") {
      const text = sel || "link text";
      insert = `[${text}](url)`;
      // Pre-select "url" so the user can type the URL immediately
      newSelStart = start + text.length + 3;
      newSelEnd = start + insert.length - 1;
    }

    setCreateDescription(before + insert + after);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(newSelStart, newSelEnd);
    }, 0);
  };

  // ── Task Detail Slide-over ──
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // ── Filters ──
  const [filterPriority, setFilterPriority] = useState<string[]>([]);
  const [filterAssignee, setFilterAssignee] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // ── DnD ──
  const [activeTask, setActiveTask] = useState<TaskCard | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── Fetch board on mount ──
  useEffect(() => {
    fetchBoard();
    fetchMembers();
  }, [fetchBoard, fetchMembers]);

  // ── Mark team as viewed on load (clears unread for this team) ──
  useEffect(() => {
    markTeamViewed(teamId);
  }, [teamId, markTeamViewed]);

  // ── Periodically mark as viewed (every 60s while board is open) ──
  useEffect(() => {
    const interval = setInterval(() => {
      markTeamViewed(teamId);
    }, 60000);
    return () => clearInterval(interval);
  }, [teamId, markTeamViewed]);

  // ── Fetch task detail when selected ──
  useEffect(() => {
    if (selectedTaskId) {
      fetchTask(selectedTaskId);
    } else {
      clearTask();
    }
  }, [selectedTaskId, fetchTask, clearTask]);

  // ── Permission ──
  const isAdmin = user?.role === "admin";
  const isDeptHead = members.some(
    (m) => m.user.id === user?.id && m.team_role === "dept_head",
  );
  const canManage = isAdmin || isDeptHead;

  // ── Compute total unread count across all columns ──
  const totalUnread =
    board?.columns.reduce(
      (sum, col) => sum + col.tasks.filter((t) => t.is_unread).length,
      0,
    ) ?? 0;

  // ── Mark all as read handler ──
  const handleMarkAllRead = () => {
    markTeamViewed(teamId);
    clearUnreadFlags();
  };

  // ══════════════════════════════════════════════════
  //  HANDLERS
  // ══════════════════════════════════════════════════

  // Open create modal (optionally with pre-selected column)
  const openCreateModal = (columnId?: string) => {
    setCreateTitle("");
    setCreateDescription("");
    setCreatePriority("medium");
    setCreateColumnId(columnId || board?.columns[0]?.id || "");
    setCreateDueDate("");
    setCreateAssigneeIds([]);
    setCreateError("");
    setShowCreateModal(true);
  };

  // Create task
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
      column_id: createColumnId || undefined,
      due_date: createDueDate || null,
      assignee_ids: createAssigneeIds,
    });

    if (result.success) {
      setShowCreateModal(false);
    } else {
      setCreateError(result.error || "Failed to create task.");
    }
    setIsCreating(false);
  };

  // Handle drag-and-drop
  const handleDragEnd = async (
    taskId: string,
    sourceColumnId: string,
    targetColumnId: string,
    newPosition: number,
  ) => {
    await moveTask(
      taskId,
      { column_id: targetColumnId, position: newPosition },
      sourceColumnId,
    );
  };

  // Calculate position for inserting between tasks
  const calculatePosition = (
    tasks: TaskCard[],
    targetIndex: number,
  ): number => {
    if (tasks.length === 0) return 1.0;
    if (targetIndex === 0) return tasks[0].position / 2;
    if (targetIndex >= tasks.length)
      return tasks[tasks.length - 1].position + 1.0;

    const before = tasks[targetIndex - 1].position;
    const after = tasks[targetIndex].position;
    return (before + after) / 2;
  };

  // Open task detail — also clear unread dot for this task
  const openTaskDetail = (taskId: string) => {
    setSelectedTaskId(taskId);
    // Clear unread flag for this specific task optimistically
    if (board) {
      // We just mark it as read locally; server-side it's cleared on next board fetch
    }
  };

  // Delete task (from detail panel)
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

  // Filter tasks client-side
  const filterTasks = (tasks: TaskCard[]): TaskCard[] => {
    return tasks.filter((t) => {
      if (filterPriority.length > 0 && !filterPriority.includes(t.priority))
        return false;
      if (
        filterAssignee &&
        !t.assignees.some((a) => a.user.id === filterAssignee)
      )
        return false;
      if (
        searchQuery &&
        !t.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;
      return true;
    });
  };

  // Check if a task is overdue
  const isOverdue = (dueDate: string | null): boolean => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  const hasFilters =
    filterPriority.length > 0 || !!filterAssignee || !!searchQuery;

  // ── DnD handlers ──
  const handleDragStartDnD = (event: DragStartEvent) => {
    const task = board?.columns
      .flatMap((c) => c.tasks)
      .find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEndDnD = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !board) return;

    const taskId = active.id as string;
    const sourceCol = board.columns.find((c) =>
      c.tasks.some((t) => t.id === taskId),
    );
    if (!sourceCol) return;

    // over.id may be a column id or a task id
    let targetCol = board.columns.find((c) => c.id === over.id);
    if (!targetCol) {
      targetCol = board.columns.find((c) =>
        c.tasks.some((t) => t.id === over.id),
      );
    }
    if (!targetCol) return;

    const targetTasks = targetCol.tasks.filter((t) => t.id !== taskId);
    const overTaskIndex = targetTasks.findIndex((t) => t.id === over.id);
    const position = calculatePosition(
      targetTasks,
      overTaskIndex >= 0 ? overTaskIndex : targetTasks.length,
    );

    handleDragEnd(taskId, sourceCol.id, targetCol.id, position);
  };

  const togglePriorityFilter = (p: string) => {
    setFilterPriority((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bg-background h-screen flex flex-col overflow-hidden animate-in fade-in duration-150">
      {/* ── Header ── */}
      <header className="shrink-0 px-6 py-3 border-b border-border bg-secondary/20 z-10">
        <div className="flex items-center justify-between gap-4">
          {/* Left: back arrow + team icon/name + tabs */}
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
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-card shadow-sm text-xs font-semibold text-foreground border border-border">
                <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                Board
              </button>
              <button
                onClick={() => startTransition(() => router.push(`/teams/${teamId}/list`))}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors"
              >
                <List className="w-3.5 h-3.5" />
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
                    <span className="w-4 h-4 rounded-full bg-primary text-white text-[9px] flex items-center justify-center">
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
                className="w-44 max-h-56 overflow-y-auto bg-card border-border rounded-xl shadow-lg p-1"
              >
                <DropdownMenuItem
                  onClick={() => setFilterAssignee("")}
                  className="flex items-center gap-2 text-xs text-muted-foreground focus:bg-secondary cursor-pointer rounded-lg py-1.5"
                >
                  All members
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {members.map((m) => (
                  <DropdownMenuItem
                    key={m.user.id}
                    onClick={() =>
                      setFilterAssignee(
                        filterAssignee === m.user.id ? "" : m.user.id,
                      )
                    }
                    className="flex items-center gap-2 text-xs text-foreground focus:bg-secondary cursor-pointer rounded-lg py-1.5"
                  >
                    <Avatar
                      name={m.user.full_name}
                      avatarUrl={m.user.avatar_url}
                      size="xs"
                    />
                    <span className="truncate">{m.user.full_name}</span>
                    {filterAssignee === m.user.id && (
                      <span className="ml-auto text-primary shrink-0">✓</span>
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
                    size="sm"
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

            {/* Mark all as read — only shown when there are unread tasks */}
            {totalUnread > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 transition-colors shadow-sm"
                title={`Mark all ${totalUnread} unread tasks as read`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                Mark all read
                <span className="ml-0.5 bg-blue-200 text-blue-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {totalUnread}
                </span>
              </button>
            )}

            {canManage && (
              <button
                onClick={() => openCreateModal()}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Task
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Board ── */}
      <main
        className="grow overflow-x-auto overflow-y-hidden px-6 py-5"
        onClick={() => {
          // dropdowns close themselves via radix
        }}
      >
        {isLoading ? (
          <BoardSkeleton />
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStartDnD}
            onDragEnd={handleDragEndDnD}
          >
            <div className="flex h-full gap-4 min-w-max pb-4 items-start">
              {board?.columns.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  filteredTasks={filterTasks(col.tasks)}
                  openCreateModal={openCreateModal}
                  openTaskDetail={openTaskDetail}
                  isOverdue={isOverdue}
                  canManage={canManage}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeTask ? (
                <div className="w-72">
                  <TaskCardView
                    task={activeTask}
                    isDone={false}
                    isInProgress={false}
                    isOverdue={isOverdue}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      {/* ── Create Task Modal ── */}
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
                placeholder="Task Title"
                className="w-full text-2xl font-bold text-foreground border-none p-0 placeholder:text-muted-foreground/40 focus:ring-0 focus:outline-none bg-transparent"
              />
            </div>

            {/* Description */}
            <div className="px-8 py-2">
              <div className="mb-2 flex items-center gap-4 text-muted-foreground border-b border-border/40 pb-2">
                <button
                  type="button"
                  title="Bold (wraps selection with **)"
                  onClick={() => handleFormat("bold")}
                  className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50"
                >
                  <Bold className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Italic (wraps selection with *)"
                  onClick={() => handleFormat("italic")}
                  className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50"
                >
                  <Italic className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Numbered list"
                  onClick={() => handleFormat("list")}
                  className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  title="Insert link"
                  onClick={() => handleFormat("link")}
                  className="hover:text-foreground transition-colors p-1 rounded hover:bg-secondary/50"
                >
                  <Link className="w-4 h-4" />
                </button>
              </div>
              <textarea
                ref={descriptionRef}
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

      {/* ── Task Detail Slide-over ── */}
      {selectedTaskId && (
        <TaskDetailPanel
          teamId={teamId}
          task={selectedTask ?? null}
          isLoading={taskDetailLoading}
          members={members}
          canManage={canManage}
          columns={
            board?.columns.map((c) => ({ id: c.id, name: c.name })) ?? []
          }
          currentUser={user ?? undefined}
          onClose={() => {
            setSelectedTaskId(null);
            clearTask();
          }}
          onUpdateTask={(taskId, data) =>
            updateTask(taskId, data as Parameters<typeof updateTask>[1])
          }
          onDeleteTask={handleDeleteTask}
          onAddAssignee={addAssignee}
          onRemoveAssignee={removeAssignee}
        />
      )}
    </div>
  );
}
