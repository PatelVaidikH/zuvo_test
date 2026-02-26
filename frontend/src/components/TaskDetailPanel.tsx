"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { TaskDetail, TeamMemberInfo, User, CommentInfo } from "@/types";
import { formatDate } from "@/lib/utils";
import { useComments } from "@/hooks/useApi";
import {
  ArrowLeft,
  MoreHorizontal,
  ChevronDown,
  Check,
  Plus,
  X,
  Trash2,
  Calendar,
  AlertTriangle,
  Pencil,
  Send,
  MessageCircle,
  Zap,
} from "lucide-react";

// ── Priority config (matches board) ──────────────────────────────────────────
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

// ── Props ─────────────────────────────────────────────────────────────────────
export interface TaskDetailPanelProps {
  teamId: string;
  task: TaskDetail | null;
  isLoading: boolean;
  members: TeamMemberInfo[];
  canManage: boolean;
  /** Board columns — used for the Status dropdown */
  columns: { id: string; name: string }[];
  currentUser?: Pick<User, "id" | "full_name" | "avatar_url" | "role">;
  onClose: () => void;
  onUpdateTask: (
    taskId: string,
    data: Record<string, unknown>,
  ) => Promise<{ success: boolean }>;
  onDeleteTask: (taskId: string) => void;
  onAddAssignee: (
    taskId: string,
    userId: string,
  ) => Promise<{ success: boolean }>;
  onRemoveAssignee: (
    taskId: string,
    userId: string,
  ) => Promise<{ success: boolean }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Returns true if comment was created within the last 24 hours */
function isWithin24h(dateStr: string) {
  return Date.now() - new Date(dateStr).getTime() < 24 * 60 * 60 * 1000;
}

/** Render comment content: replace @[uuid] with @Name */
function renderMentions(content: string, members: TeamMemberInfo[]): string {
  return content.replace(/@\[([0-9a-f-]+)\]/gi, (_, uuid) => {
    const m = members.find((mem) => mem.user.id === uuid);
    return m ? `@${m.user.full_name}` : "@unknown";
  });
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl?: string | null;
  size?: "sm" | "md";
}) {
  const sz = size === "sm" ? "w-6 h-6 text-[9px]" : "w-8 h-8 text-[11px]";
  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={32}
        height={32}
        className={`${sz} rounded-full object-cover border-2 border-background ring-1 ring-border shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${sz} rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center border-2 border-background ring-1 ring-border shrink-0`}
    >
      {getInitials(name)}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonPanel() {
  return (
    <div className="animate-pulse space-y-5 pt-2">
      <div className="h-5 w-16 bg-secondary rounded-full" />
      <div className="h-7 w-3/4 bg-secondary rounded" />
      <div className="h-7 w-1/2 bg-secondary rounded" />
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full bg-secondary rounded" />
        <div className="h-4 w-5/6 bg-secondary rounded" />
        <div className="h-4 w-2/3 bg-secondary rounded" />
      </div>
    </div>
  );
}

// ── Comment skeleton ──────────────────────────────────────────────────────────
function CommentSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-secondary rounded" />
            <div className="h-4 w-3/4 bg-secondary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── System Comment Row ─────────────────────────────────────────────────────────
function SystemCommentRow({ comment }: { comment: CommentInfo }) {
  return (
    <div className="flex gap-3 items-start">
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className="w-6 h-6 rounded-full bg-secondary/80 border border-border flex items-center justify-center">
          <Zap className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-xs text-muted-foreground leading-relaxed">
          {comment.content}
        </p>
        <span className="text-[10px] text-muted-foreground/50 mt-0.5 block">
          {timeAgo(comment.created_at)}
        </span>
      </div>
    </div>
  );
}

// ── User Comment Row ───────────────────────────────────────────────────────────
function UserCommentRow({
  comment,
  members,
  canEditThis,
  canDeleteThis,
  isEditing,
  editingContent,
  onStartEdit,
  onEditChange,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  comment: CommentInfo;
  members: TeamMemberInfo[];
  canEditThis: boolean;
  canDeleteThis: boolean;
  isEditing: boolean;
  editingContent: string;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}) {
  const authorName = comment.user?.full_name ?? "Unknown";

  if (comment.is_deleted) {
    return (
      <div className="flex gap-3 items-start opacity-50">
        <div className="w-8 h-8 rounded-full bg-secondary shrink-0" />
        <div className="flex-1 min-w-0 pt-1">
          <p className="text-sm italic text-muted-foreground">
            [This comment was deleted]
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start group">
      <Avatar
        name={authorName}
        avatarUrl={comment.user?.avatar_url}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-bold text-foreground">{authorName}</span>
          <span className="text-xs text-muted-foreground">
            {timeAgo(comment.created_at)}
          </span>
          {comment.is_edited && (
            <span className="text-[10px] text-muted-foreground/50 italic">
              (edited)
            </span>
          )}
          {/* Edit / Delete controls — appear on hover */}
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEditThis && !isEditing && (
              <button
                onClick={onStartEdit}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Edit comment"
              >
                <Pencil className="w-3 h-3" />
              </button>
            )}
            {canDeleteThis && !isEditing && (
              <button
                onClick={onDelete}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete comment"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-2">
            <textarea
              autoFocus
              value={editingContent}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSaveEdit();
                if (e.key === "Escape") onCancelEdit();
              }}
              rows={3}
              className="w-full text-sm text-foreground bg-secondary/30 border border-input rounded-lg p-2.5 resize-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={onSaveEdit}
                disabled={!editingContent.trim()}
                className="text-xs font-semibold px-3 py-1 bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={onCancelEdit}
                className="text-xs font-semibold px-3 py-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {renderMentions(comment.content, members)}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function TaskDetailPanel({
  teamId,
  task,
  isLoading,
  members,
  canManage,
  columns,
  currentUser,
  onClose,
  onUpdateTask,
  onDeleteTask,
  onAddAssignee,
  onRemoveAssignee,
}: TaskDetailPanelProps) {
  // Editing task fields
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editDescription, setEditDescription] = useState("");

  // Dropdowns
  const [showPriorityDd, setShowPriorityDd] = useState(false);
  const [showStatusDd, setShowStatusDd] = useState(false);
  const [showAssigneeDd, setShowAssigneeDd] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // Comments hook
  const {
    comments,
    isLoading: commentsLoading,
    fetchComments,
    addComment,
    editComment,
    deleteComment,
  } = useComments(teamId, task?.id ?? "");

  // Comment input state
  const [commentText, setCommentText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");

  // @mention dropdown
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(-1);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Fetch comments when task changes
  useEffect(() => {
    if (task?.id) {
      fetchComments();
    }
  }, [task?.id, fetchComments]);

  const currentUserId = currentUser?.id;
  const currentUserRole = currentUser?.role ?? "employee";

  // Can edit: own comment + within 24h
  const canEditComment = useCallback(
    (comment: CommentInfo) => {
      if (comment.is_system || comment.is_deleted) return false;
      if (comment.user?.id !== currentUserId) return false;
      return isWithin24h(comment.created_at);
    },
    [currentUserId],
  );

  // Can delete: own comment OR admin/dept_head
  const canDeleteComment = useCallback(
    (comment: CommentInfo) => {
      if (comment.is_system || comment.is_deleted) return false;
      if (comment.user?.id === currentUserId) return true;
      return (
        currentUserRole === "admin" ||
        currentUserRole === "super_admin" ||
        canManage
      );
    },
    [currentUserId, currentUserRole, canManage],
  );

  // Handle @mention typing
  const handleCommentInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCommentText(val);

    const cursor = e.target.selectionStart ?? val.length;
    // Find the last @ before cursor
    const textToCursor = val.slice(0, cursor);
    const atIdx = textToCursor.lastIndexOf("@");
    if (atIdx >= 0 && !textToCursor.slice(atIdx).includes(" ")) {
      setMentionSearch(textToCursor.slice(atIdx + 1).toLowerCase());
      setMentionStart(atIdx);
    } else {
      setMentionSearch(null);
      setMentionStart(-1);
    }
  };

  const insertMention = (member: TeamMemberInfo) => {
    const before = commentText.slice(0, mentionStart);
    const after = commentText.slice(mentionStart + 1 + (mentionSearch?.length ?? 0));
    const newText = `${before}@[${member.user.id}]${after} `;
    setCommentText(newText);
    setMentionSearch(null);
    setMentionStart(-1);
    commentRef.current?.focus();
  };

  const filteredMentionMembers =
    mentionSearch !== null
      ? members.filter((m) =>
          m.user.full_name.toLowerCase().includes(mentionSearch),
        )
      : [];

  const handleSendComment = async () => {
    if (!commentText.trim() || isSubmitting) return;
    setIsSubmitting(true);
    await addComment(commentText.trim());
    setCommentText("");
    setMentionSearch(null);
    setIsSubmitting(false);
  };

  const handleSaveEdit = async () => {
    if (!editingCommentId || !editingContent.trim()) return;
    await editComment(editingCommentId, editingContent.trim());
    setEditingCommentId(null);
    setEditingContent("");
  };

  const handleDeleteComment = async (commentId: string) => {
    await deleteComment(commentId);
  };

  const availableMembers = members.filter(
    (m) => !task?.assignees.some((a) => a.user.id === m.user.id),
  );

  const saveTitle = async () => {
    if (task && editTitle.trim())
      await onUpdateTask(task.id, { title: editTitle.trim() });
    setIsEditingTitle(false);
  };

  const saveDescription = async () => {
    if (task) await onUpdateTask(task.id, { description: editDescription });
    setIsEditingDescription(false);
  };

  const closeAllDd = () => {
    setShowPriorityDd(false);
    setShowStatusDd(false);
    setShowAssigneeDd(false);
    setShowMoreMenu(false);
  };

  const priority = task
    ? (PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium)
    : null;

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] z-40"
        onClick={() => {
          closeAllDd();
          onClose();
        }}
      />

      {/* ── Slide-over panel ── */}
      <div
        className="fixed top-0 right-0 h-full w-full max-w-120 bg-card shadow-2xl z-50 border-l border-border flex flex-col"
        onClick={closeAllDd}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-secondary/50 shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back
          </button>

          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowMoreMenu((p) => !p)}
              className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary transition-colors"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
            {showMoreMenu && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-lg py-1.5 w-36 z-10">
                {canManage && task ? (
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onDeleteTask(task.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-destructive hover:bg-secondary transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete task
                  </button>
                ) : (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No actions available
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isLoading ? (
            <SkeletonPanel />
          ) : task ? (
            <>
              {/* Priority badge */}
              <div
                className="mb-4 relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowPriorityDd((p) => !p)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                    priority?.badgeClass ?? "bg-secondary text-muted-foreground"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${priority?.dotClass}`}
                  />
                  {priority?.label ?? task.priority}
                  <ChevronDown className="w-3 h-3 ml-0.5" />
                </button>
                {showPriorityDd && (
                  <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-lg py-1.5 w-36 z-10">
                    {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={async () => {
                          setShowPriorityDd(false);
                          await onUpdateTask(task.id, { priority: key });
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${cfg.dotClass}`}
                        />
                        {cfg.label}
                        {task.priority === key && (
                          <Check className="w-3 h-3 ml-auto text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title */}
              {isEditingTitle ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveTitle();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  className="w-full text-2xl font-bold text-foreground border-none p-0 bg-transparent focus:ring-0 focus:outline-none mb-6"
                />
              ) : (
                <h2
                  onClick={() =>
                    canManage &&
                    (setEditTitle(task.title), setIsEditingTitle(true))
                  }
                  className={`text-2xl font-bold text-foreground leading-tight mb-6 ${
                    canManage
                      ? "cursor-text hover:text-primary/80 transition-colors"
                      : ""
                  }`}
                >
                  {task.title}
                </h2>
              )}

              {/* Metadata grid */}
              <div className="space-y-3 mb-6">
                {/* Status */}
                <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Status
                  </span>
                  <div
                    className="relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setShowStatusDd((p) => !p)}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-secondary/50 border border-border/60 text-sm font-medium text-foreground hover:border-primary/40 transition-colors"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary/60" />
                      {task.column_name}
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    {showStatusDd && (
                      <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-lg py-1.5 w-44 z-10">
                        {columns.map((col) => (
                          <button
                            key={col.id}
                            onClick={async () => {
                              setShowStatusDd(false);
                              await onUpdateTask(task.id, {
                                column_id: col.id,
                              });
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                          >
                            {col.name}
                            {task.column_name === col.name && (
                              <Check className="w-3 h-3 ml-auto text-primary" />
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Due date */}
                <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Due Date
                  </span>
                  <label
                    className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/50 text-sm font-medium cursor-pointer transition-colors ${
                      task.due_date && new Date(task.due_date) < new Date()
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {task.due_date && new Date(task.due_date) < new Date() ? (
                      <AlertTriangle className="w-3.5 h-3.5" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    {task.due_date ? formatDate(task.due_date) : "No due date"}
                    {canManage && (
                      <input
                        type="date"
                        className="sr-only"
                        value={task.due_date ? task.due_date.slice(0, 10) : ""}
                        onChange={(e) =>
                          onUpdateTask(task.id, {
                            due_date: e.target.value
                              ? new Date(e.target.value).toISOString()
                              : null,
                          })
                        }
                      />
                    )}
                  </label>
                </div>

                {/* Created by */}
                <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground">
                    Created by
                  </span>
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={task.created_by.full_name}
                      avatarUrl={task.created_by.avatar_url}
                      size="sm"
                    />
                    <span className="text-sm text-foreground">
                      {task.created_by.full_name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      · {formatDate(task.created_at)}
                    </span>
                  </div>
                </div>

                {/* Assignees */}
                <div className="grid grid-cols-[100px_1fr] items-start gap-4 pt-1">
                  <span className="text-sm font-medium text-muted-foreground mt-1.5">
                    Assignees
                  </span>
                  <div
                    className="flex flex-wrap items-center gap-2 relative"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {task.assignees.length === 0 && (
                      <span className="text-sm text-muted-foreground/60">
                        Unassigned
                      </span>
                    )}
                    {task.assignees.map((a) => (
                      <div
                        key={a.user.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/50 border border-border/60 group"
                      >
                        <Avatar
                          name={a.user.full_name}
                          avatarUrl={a.user.avatar_url}
                          size="sm"
                        />
                        <span className="text-xs font-medium text-foreground">
                          {a.user.full_name}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => onRemoveAssignee(task.id, a.user.id)}
                            className="ml-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {canManage && (
                      <div className="relative">
                        <button
                          onClick={() => setShowAssigneeDd((p) => !p)}
                          className="w-7 h-7 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        {showAssigneeDd && (
                          <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-xl shadow-lg py-1.5 w-44 max-h-48 overflow-y-auto z-10">
                            {availableMembers.length === 0 ? (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                All members assigned
                              </p>
                            ) : (
                              availableMembers.map((m) => (
                                <button
                                  key={m.user.id}
                                  onClick={async () => {
                                    await onAddAssignee(task.id, m.user.id);
                                    setShowAssigneeDd(false);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                                >
                                  <Avatar
                                    name={m.user.full_name}
                                    avatarUrl={m.user.avatar_url}
                                    size="sm"
                                  />
                                  {m.user.full_name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <hr className="border-border/40 my-6" />

              {/* Description */}
              <div className="mb-8">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                  Description
                </h3>
                {isEditingDescription ? (
                  <textarea
                    autoFocus
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    onBlur={saveDescription}
                    rows={5}
                    className="w-full text-sm text-foreground leading-relaxed bg-secondary/30 border border-input rounded-lg p-3 resize-none focus:ring-1 focus:ring-primary focus:border-primary focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() =>
                      canManage &&
                      (setEditDescription(task.description || ""),
                      setIsEditingDescription(true))
                    }
                    className={`text-sm leading-relaxed whitespace-pre-wrap rounded-lg transition-colors ${
                      canManage
                        ? "cursor-text hover:bg-secondary/30 px-2 py-1.5 -mx-2"
                        : ""
                    } ${
                      task.description
                        ? "text-foreground/90"
                        : "text-muted-foreground/50 italic"
                    }`}
                  >
                    {task.description || "Add a description…"}
                  </div>
                )}
              </div>

              <hr className="border-border/40 mb-6" />

              {/* ── Activity / Comments ── */}
              <div className="pb-4">
                <div className="flex items-center gap-2 mb-5">
                  <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Activity
                  </h3>
                  {comments.length > 0 && (
                    <span className="ml-1 text-[10px] font-semibold bg-secondary text-muted-foreground rounded-full px-1.5 py-0.5">
                      {comments.length}
                    </span>
                  )}
                </div>

                {commentsLoading ? (
                  <CommentSkeleton />
                ) : (
                  <div className="space-y-5">
                    {/* Task creation event — always first */}
                    <div className="flex gap-3 items-start">
                      <div className="w-2 h-2 rounded-full bg-border mt-2 shrink-0 ring-4 ring-card ml-3" />
                      <p className="text-xs text-muted-foreground pt-1">
                        <span className="font-semibold text-foreground">
                          {task.created_by.full_name}
                        </span>{" "}
                        created this task · {formatDate(task.created_at)}
                      </p>
                    </div>

                    {/* Comments list */}
                    {comments.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic pl-8">
                        No comments yet. Be the first to add one.
                      </p>
                    ) : (
                      comments.map((c) =>
                        c.is_system ? (
                          <SystemCommentRow key={c.id} comment={c} />
                        ) : (
                          <UserCommentRow
                            key={c.id}
                            comment={c}
                            members={members}
                            canEditThis={canEditComment(c)}
                            canDeleteThis={canDeleteComment(c)}
                            isEditing={editingCommentId === c.id}
                            editingContent={editingContent}
                            onStartEdit={() => {
                              setEditingCommentId(c.id);
                              setEditingContent(c.content);
                            }}
                            onEditChange={setEditingContent}
                            onSaveEdit={handleSaveEdit}
                            onCancelEdit={() => {
                              setEditingCommentId(null);
                              setEditingContent("");
                            }}
                            onDelete={() => handleDeleteComment(c.id)}
                          />
                        ),
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* ── Sticky comment footer ── */}
        <div className="p-5 bg-secondary/40 border-t border-border shrink-0">
          <div
            className="relative bg-card border border-input rounded-lg shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* @mention dropdown */}
            {mentionSearch !== null && filteredMentionMembers.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 w-56 bg-card border border-border rounded-xl shadow-lg py-1.5 max-h-40 overflow-y-auto z-20">
                {filteredMentionMembers.map((m) => (
                  <button
                    key={m.user.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertMention(m);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors"
                  >
                    <Avatar
                      name={m.user.full_name}
                      avatarUrl={m.user.avatar_url}
                      size="sm"
                    />
                    {m.user.full_name}
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={commentRef}
              value={commentText}
              onChange={handleCommentInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  handleSendComment();
              }}
              placeholder="Write a comment… (type @ to mention)"
              rows={2}
              className="w-full px-4 pt-3 pb-1 text-sm text-foreground bg-transparent border-none focus:ring-0 focus:outline-none resize-none placeholder:text-muted-foreground/60"
            />
            <div className="flex items-center justify-end px-3 pb-2 gap-2">
              <span className="text-[10px] text-muted-foreground/50 select-none">
                ⌘↵ to send
              </span>
              <button
                onClick={handleSendComment}
                disabled={!commentText.trim() || isSubmitting}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded text-xs font-bold tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3 h-3" />
                Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
