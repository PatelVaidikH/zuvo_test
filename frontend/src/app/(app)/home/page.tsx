"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTeams, useCompanyMembers, useActivityFeed, useUnreadCounts } from "@/hooks/useApi";
import type { ActivityEntry } from "@/types";
import type { CreateCompanyMemberFormData } from "@/types";
import {
  X,
  ArrowRight,
  Megaphone,
  PenTool,
  Code,
  Settings,
  TrendingUp,
  Rocket,
  Lightbulb,
  Verified,
  Folder,
  LayoutGrid,
  Zap,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  UsersRound,
  Copy,
  Check,
  Contact,
  MoreHorizontal,
  ChevronDown,
  // Activity feed action icons
  Plus,
  MoveRight,
  UserCheck,
  MessageCircle,
  UserPlus2,
  Building2,
  Activity,
  Clock,
} from "lucide-react";

// Preset colors for the team color picker mapped to your theme
const TEAM_COLORS = [
  "#5F6F62", // primary (Moss/Sage)
  "#a67c52", // destructive (Terracotta)
  "#E5E0D8", // Sand
  "#64748B", // Slate
  "#818CF8", // Slate Blue
  "#7E7A75", // Stone/Grey
  "#DCD7CE", // Light Stone
  "#2C2C2C", // Deep Ink
];

// Preset icons mapped to Lucide components
const TEAM_ICONS = [
  { id: "campaign", icon: <Megaphone className="w-5 h-5" /> },
  { id: "design", icon: <PenTool className="w-5 h-5" /> },
  { id: "code", icon: <Code className="w-5 h-5" /> },
  { id: "settings", icon: <Settings className="w-5 h-5" /> },
  { id: "trending", icon: <TrendingUp className="w-5 h-5" /> },
  { id: "rocket", icon: <Rocket className="w-5 h-5" /> },
  { id: "idea", icon: <Lightbulb className="w-5 h-5" /> },
  { id: "verified", icon: <Verified className="w-5 h-5" /> },
  { id: "folder", icon: <Folder className="w-5 h-5" /> },
  { id: "grid", icon: <LayoutGrid className="w-5 h-5" /> },
  { id: "bolt", icon: <Zap className="w-5 h-5" /> },
  { id: "more", icon: <MoreHorizontal className="w-5 h-5" /> },
];

// ── Activity helpers ─────────────────────────────────────────────
function timeAgo(isoString: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(isoString).getTime()) / 1000,
  );
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function getInitialsFromName(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

// ── Action icon + color-coded left border ─────────────────────────────────────
function getActionConfig(action: string): {
  icon: React.ReactNode;
  borderColor: string;
} {
  if (action.startsWith("task_")) {
    let icon = <Plus className="w-3 h-3" />;
    if (action === "task_moved") icon = <MoveRight className="w-3 h-3" />;
    else if (action === "task_assigned") icon = <UserCheck className="w-3 h-3" />;
    else if (action === "task_unassigned") icon = <UserCheck className="w-3 h-3" />;
    return { icon, borderColor: "border-blue-400" };
  }
  if (action === "comment_added" || action === "comment_edited" || action === "comment_deleted") {
    return { icon: <MessageCircle className="w-3 h-3" />, borderColor: "border-green-400" };
  }
  if (action === "member_added" || action === "member_removed" || action === "user_invited_to_team") {
    return { icon: <UserPlus2 className="w-3 h-3" />, borderColor: "border-orange-400" };
  }
  if (action.startsWith("team_")) {
    return { icon: <Building2 className="w-3 h-3" />, borderColor: "border-[#a67c52]" };
  }
  return { icon: <Activity className="w-3 h-3" />, borderColor: "border-border" };
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const initials = getInitialsFromName(entry.user_name);
  // Use server-generated activity_text if available, otherwise fallback to action_display
  const text = entry.activity_text || entry.action_display;
  const { icon, borderColor } = getActionConfig(entry.action);
  const teamName = entry.metadata?.team_name as string | undefined;

  return (
    <div
      className={`flex items-start gap-3 p-2.5 rounded-lg border-l-2 hover:bg-secondary/40 transition-colors bg-secondary/10 ${borderColor}`}
    >
      {/* Action icon */}
      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground leading-snug">
          <span className="font-semibold">{entry.user_name}</span>{" "}
          <span className="text-muted-foreground">{text}</span>
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-muted-foreground/70">
            {timeAgo(entry.created_at)}
          </p>
          {teamName && (
            <span className="text-[10px] bg-secondary text-muted-foreground rounded px-1.5 py-0.5 font-medium">
              {teamName}
            </span>
          )}
        </div>
      </div>
      {/* Avatar initials */}
      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary shrink-0 mt-0.5">
        {initials || "?"}
      </div>
    </div>
  );
}

// ── Date group label ──────────────────────────────────────────────────────────
function DateGroupLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="h-px flex-1 bg-border/60" />
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 px-1">
        {label}
      </span>
      <div className="h-px flex-1 bg-border/60" />
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { teams, isLoading, totalCount, fetchTeams, createTeam } = useTeams();
  const {
    groupedActivities,
    isLoading: activityLoading,
    hasMore,
    fetchActivity,
    loadMore,
  } = useActivityFeed();
  const { unreadCounts, fetchUnreadCounts, markTeamViewed } = useUnreadCounts();

  // ── Create Team Modal ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createIcon, setCreateIcon] = useState(TEAM_ICONS[0].id);
  const [createColor, setCreateColor] = useState(TEAM_COLORS[0]);
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ── Fetch teams on mount ──
  useEffect(() => {
    fetchTeams();
    fetchActivity();
    fetchUnreadCounts();
  }, [fetchTeams, fetchActivity, fetchUnreadCounts]);

  // ── Create Team Handler ──
  const handleCreateTeam = async () => {
    if (!createName.trim()) {
      setCreateError("Team name is required.");
      return;
    }
    setIsCreating(true);
    setCreateError("");

    const result = await createTeam({
      name: createName.trim(),
      description: createDescription.trim(),
      icon: createIcon,
      color: createColor,
    });

    if (result.success) {
      setShowCreateModal(false);
      resetCreateForm();
    } else {
      setCreateError(result.error || "Failed to create team.");
    }
    setIsCreating(false);
  };

  const resetCreateForm = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateIcon(TEAM_ICONS[0].id);
    setCreateColor(TEAM_COLORS[0]);
    setCreateError("");
  };

  const openCreateModal = () => {
    resetCreateForm();
    setShowCreateModal(true);
  };

  // ── Navigation Handlers ──
  const navigateToTeamBoard = (teamId: string) => {
    markTeamViewed(teamId); // Clear unread count when entering board
    router.push(`/teams/${teamId}/board`);
  };

  const navigateToTeamMembers = (teamId: string) => {
    router.push(`/teams/${teamId}/members`);
  };

  const navigateToTeamSettings = (teamId: string) => {
    router.push(`/teams/${teamId}/settings`);
  };

  // ── Determine if empty state should show ──
  const isEmpty = !isLoading && teams.length === 0;
  const isAdmin = user?.role === "admin";
  const canCreateTeam = user?.role === "admin" || user?.role === "dept_head";

  // ── Add Member / All Members ──
  const { allMembers, isLoadingAll, fetchAllMembers, createCompanyMember } =
    useCompanyMembers();
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showAllMembersModal, setShowAllMembersModal] = useState(false);
  const [addForm, setAddForm] = useState<CreateCompanyMemberFormData>({
    full_name: "",
    email: "",
    contact_number: "",
    role: "employee",
    email_secondary: "",
  });
  const [addMemberError, setAddMemberError] = useState("");
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [credentials, setCredentials] = useState<{
    username: string;
    temporary_password: string;
  } | null>(null);
  const [activeMembersTab, setActiveMembersTab] = useState<
    "dept_head" | "employee"
  >("dept_head");
  const [copiedField, setCopiedField] = useState<
    "username" | "password" | null
  >(null);

  useEffect(() => {
    if (showAllMembersModal) fetchAllMembers();
  }, [showAllMembersModal, fetchAllMembers]);

  const handleAddMember = async () => {
    if (!addForm.full_name.trim() || !addForm.email.trim()) {
      setAddMemberError("Full name and email are required.");
      return;
    }
    setIsAddingMember(true);
    setAddMemberError("");
    const result = await createCompanyMember({
      ...addForm,
      email: addForm.email.trim().toLowerCase(),
      full_name: addForm.full_name.trim(),
    });
    setIsAddingMember(false);
    if (result.success && result.result) {
      setShowAddMemberModal(false);
      setAddForm({
        full_name: "",
        email: "",
        contact_number: "",
        role: "employee",
        email_secondary: "",
      });
      setCredentials(result.result.credentials);
    } else {
      setAddMemberError(result.error || "Failed to create member.");
    }
  };

  const copyToClipboard = (text: string, field: "username" | "password") => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // ── YOUR STITCH UI GOES BELOW ──
  //
  // NAVIGATION BAR:
  //   user?.full_name                → display name
  //   user?.avatar_url               → avatar image (or use getInitials)
  //   logout                         → logout button onClick
  //
  // PAGE HEADER:
  //   "Your Teams"                   → title
  //   totalCount                     → "X teams"
  //   isAdmin && openCreateModal     → "+ New Team" button (Admin only)
  //
  // EMPTY STATE (isEmpty === true):
  //   Show beautiful empty state with illustration
  //   "Welcome to Zuvo, {user?.full_name?.split(' ')[0]}! 👋"
  //   "Start by creating your first team."
  //   isAdmin && openCreateModal     → "Create Your First Team" button
  //   !isAdmin → "You haven't been added to any teams yet."
  //
  // TEAM CARDS (teams.map):
  //   Each team has: id, name, description, icon, color, member_count
  //   team.icon                      → display emoji
  //   team.color                     → card accent color / border
  //   team.name                      → team name
  //   team.description               → subtitle text
  //   team.member_count              → "X members"
  //   () => navigateToTeamBoard(team.id)     → "Open Board →" click
  //   () => navigateToTeamMembers(team.id)   → members icon/link
  //   () => navigateToTeamSettings(team.id)  → settings icon (Admin/DeptHead)
  //
  // LOADING STATE:
  //   isLoading                      → show skeleton cards
  //
  // CREATE TEAM MODAL (showCreateModal):
  //   createName, setCreateName           → team name input
  //   createDescription, setCreateDescription → description textarea
  //   createIcon, setCreateIcon           → emoji picker (map TEAM_ICONS)
  //   createColor, setCreateColor         → color picker (map TEAM_COLORS)
  //   createError                         → error message
  //   isCreating                          → loading state
  //   handleCreateTeam                    → submit button
  //   () => setShowCreateModal(false)     → cancel/close
  //
  // Icon Picker Example:
  //   TEAM_ICONS.map(icon => (
  //     <button
  //       key={icon}
  //       onClick={() => setCreateIcon(icon)}
  //       className={createIcon === icon ? "selected" : ""}
  //     >
  //       {icon}
  //     </button>
  //   ))
  //
  // Color Picker Example:
  //   TEAM_COLORS.map(color => (
  //     <button
  //       key={color}
  //       onClick={() => setCreateColor(color)}
  //       style={{ backgroundColor: color }}
  //       className={createColor === color ? "selected" : ""}
  //     />
  //   ))

  return (
    <div className="bg-background min-h-screen flex flex-col font-sans antialiased selection:bg-primary/30 relative overflow-x-hidden">
      {/* NAVIGATION BAR (Simple integrated header as requested) */}
      {/* <header className="w-full bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-foreground font-bold text-xl">
            <Sprout className="w-6 h-6 text-primary" />
            Zuvo
          </div>
          <div className="flex items-center gap-4 border-l border-border pl-6 h-8">
            <button
              onClick={() => logout()}
              className="text-muted-foreground hover:text-destructive transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center border border-border cursor-pointer overflow-hidden">
              {user?.full_name ? (
                <span className="text-xs font-bold text-primary">
                  {user.full_name.charAt(0)}
                </span>
              ) : (
                <UserIcon className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      </header> */}

      {/* PAGE HEADER */}
      {!isEmpty && (
        <div className="w-full px-8 pt-10 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              Your Teams
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {totalCount} active workspaces
            </p>
          </div>
          {(isAdmin || canCreateTeam) && (
            <div className="flex items-center gap-3">
              {isAdmin && (
                <>
                  <button
                    onClick={() => setShowAllMembersModal(true)}
                    className="flex items-center gap-2 border border-border text-foreground hover:bg-secondary px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  >
                    <UsersRound className="w-4 h-4" />
                    All Members
                  </button>
                  <button
                    onClick={() => setShowAddMemberModal(true)}
                    className="flex items-center gap-2 border border-border text-foreground hover:bg-secondary px-4 py-2.5 rounded-lg text-sm font-medium transition-all"
                  >
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </button>
                </>
              )}
              {canCreateTeam && (
                <button
                  onClick={openCreateModal}
                  className="bg-primary hover:opacity-90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-all"
                >
                  + New Team
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* SKELETON LOADING STATE */}
      {isLoading && (
        <main className="grow w-full px-8 pb-16 pt-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-border p-6 h-48 animate-pulse flex flex-col"
              >
                <div className="w-12 h-12 bg-secondary rounded-full mb-4" />
                <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
                <div className="h-3 bg-secondary rounded w-3/4 mb-auto" />
                <div className="h-3 bg-secondary rounded w-1/4 mt-4" />
              </div>
            ))}
          </div>
        </main>
      )}

      {/* EMPTY STATE */}
      {isEmpty && (
        <main className="grow flex flex-col items-center justify-center px-4 -mt-16 animate-in fade-in duration-500">
          <div className="max-w-lg w-full text-center space-y-8">
            <div className="flex justify-center mb-6">
              <div className="relative w-48 h-48 flex items-center justify-center">
                <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl transform scale-75" />
                <svg
                  className="text-foreground opacity-90 relative z-10"
                  fill="none"
                  height="180"
                  viewBox="0 0 200 200"
                  width="180"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M60 160H140M60 160V80L100 50L140 80V160M60 160H40M140 160H160"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M85 100H95M105 100H115M85 125H95M105 125H115"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M92 160V145C92 142.791 93.7909 141 96 141H104C106.209 141 108 142.791 108 145V160"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <path
                    d="M150 160V145C150 142 154 140 154 140"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M50 160V150C50 148 46 145 46 145"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx="150"
                    cy="60"
                    r="12"
                    stroke="currentColor"
                    strokeDasharray="2 4"
                    strokeWidth="1.5"
                  />
                  <rect
                    className="text-primary"
                    height="20"
                    rx="4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    transform="rotate(-15 40 80)"
                    width="20"
                    x="30"
                    y="70"
                  />
                  <circle
                    className="text-primary"
                    cx="170"
                    cy="110"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                Welcome to Zuvo, {user?.full_name?.split(" ")[0] || "User"}!{" "}
                <span className="inline-block animate-pulse">👋</span>
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed max-w-md mx-auto font-normal">
                Teams are the heart of Zuvo. Create a space for your colleagues
                to collaborate, share documents, and track progress
                effortlessly.
              </p>
            </div>

            <div className="pt-4">
              {canCreateTeam ? (
                <button
                  onClick={openCreateModal}
                  className="bg-primary hover:opacity-90 text-primary-foreground px-8 py-4 rounded-xl text-base font-semibold inline-flex items-center gap-3 shadow-sm transition-all group"
                >
                  Create Your First Team
                  <ArrowRight className="text-white/80 group-hover:translate-x-1 transition-transform w-5 h-5" />
                </button>
              ) : (
                <p className="px-8 py-4 rounded-xl bg-secondary text-muted-foreground text-sm border border-border">
                  You haven&apos;t been added to any teams yet. Please contact
                  your workspace administrator.
                </p>
              )}
            </div>
          </div>
        </main>
      )}

      {/* TEAM CARDS GRID */}
      {!isEmpty && !isLoading && (
        <main className="grow w-full px-8 pb-16">
          <div className="flex gap-8 items-start">
            <div className="flex-1 min-w-0">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    onClick={() => navigateToTeamBoard(team.id)}
                    className="bg-white rounded-lg border border-border p-6 flex flex-col h-full hover:shadow-md hover:border-primary/50 cursor-pointer group transition-all relative"
                  >
                    {/* Unread badge */}
                    {(unreadCounts[team.id]?.unread_count ?? 0) > 0 && (
                      <div className="absolute top-3 right-3 animate-in zoom-in-75 duration-200">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">
                          {unreadCounts[team.id].unread_count} new
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mb-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm shrink-0"
                        style={{ backgroundColor: team.color || "#5F6F62" }}
                      >
                        {TEAM_ICONS.find((i) => i.id === team.icon)?.icon || (
                          <Folder className="w-5 h-5" />
                        )}
                      </div>

                      {/* Hover action icons — inline with circle */}
                      <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToTeamMembers(team.id);
                          }}
                          title="Members"
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-white transition-all"
                          style={{}}
                          onMouseEnter={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = team.color || "#5F6F62";
                          }}
                          onMouseLeave={(e) => {
                            (
                              e.currentTarget as HTMLButtonElement
                            ).style.backgroundColor = "";
                          }}
                        >
                          <Contact className="w-5 h-5" />
                        </button>
                        {canCreateTeam && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToTeamSettings(team.id);
                            }}
                            title="Settings"
                            className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-white transition-all"
                            onMouseEnter={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.backgroundColor = team.color || "#5F6F62";
                            }}
                            onMouseLeave={(e) => {
                              (
                                e.currentTarget as HTMLButtonElement
                              ).style.backgroundColor = "";
                            }}
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {team.name}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed mb-6 grow line-clamp-2">
                      {team.description || "No description provided."}
                    </p>

                    <div className="border-t border-border pt-4 mt-auto">
                      <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mb-4">
                        <div
                          className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateToTeamMembers(team.id);
                          }}
                        >
                          <Users className="w-4 h-4" /> {team.member_count || 0}{" "}
                          members
                        </div>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Active
                        </div>
                      </div>
                      <div className="flex items-center text-primary font-medium text-sm group-hover:underline decoration-1 underline-offset-4">
                        Open Board <ArrowRight className="w-4 h-4 ml-1" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT: Activity Sidebar — sticky, scrollable */}
            <div className="w-72 xl:w-80 shrink-0 sticky top-8 self-start">
              <div
                className="bg-white rounded-lg border border-border flex flex-col"
                style={{ maxHeight: "calc(100vh - 10rem)" }}
              >
                <div className="px-5 pt-5 pb-3 border-b border-border shrink-0 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-base font-bold text-foreground">
                    Activity
                  </h2>
                </div>
                <div className="overflow-y-auto flex-1 p-4 flex flex-col gap-1">
                  {activityLoading &&
                  Object.values(groupedActivities).every(
                    (g) => g.length === 0,
                  ) ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : Object.values(groupedActivities).every(
                      (g) => g.length === 0,
                    ) ? (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      No recent activity.
                    </p>
                  ) : (
                    <>
                      {groupedActivities.today.length > 0 && (
                        <>
                          <DateGroupLabel label="Today" />
                          {groupedActivities.today.map((a) => (
                            <ActivityItem key={a.id} entry={a} />
                          ))}
                        </>
                      )}
                      {groupedActivities.yesterday.length > 0 && (
                        <>
                          <DateGroupLabel label="Yesterday" />
                          {groupedActivities.yesterday.map((a) => (
                            <ActivityItem key={a.id} entry={a} />
                          ))}
                        </>
                      )}
                      {groupedActivities.this_week.length > 0 && (
                        <>
                          <DateGroupLabel label="This Week" />
                          {groupedActivities.this_week.map((a) => (
                            <ActivityItem key={a.id} entry={a} />
                          ))}
                        </>
                      )}
                      {groupedActivities.older.length > 0 && (
                        <>
                          <DateGroupLabel label="Older" />
                          {groupedActivities.older.map((a) => (
                            <ActivityItem key={a.id} entry={a} />
                          ))}
                        </>
                      )}
                      {hasMore && (
                        <button
                          onClick={loadMore}
                          disabled={activityLoading}
                          className="mt-3 w-full text-xs font-semibold text-muted-foreground hover:text-foreground py-2 border border-dashed border-border rounded-lg hover:border-primary/40 hover:bg-secondary/30 transition-all disabled:opacity-50"
                        >
                          {activityLoading ? (
                            <span className="flex items-center justify-center gap-1.5">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Loading…
                            </span>
                          ) : (
                            "Load more"
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* CREATE TEAM MODAL */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative bg-white w-full max-w-lg rounded-lg shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-foreground">Create Team</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {createError && (
                <div className="p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <p>{createError}</p>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-bold text-foreground"
                    htmlFor="team-name"
                  >
                    Team Name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    disabled={isCreating}
                    className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm py-3 outline-none transition-all"
                    placeholder="e.g. Marketing, Engineering"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-bold text-foreground"
                    htmlFor="description"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    disabled={isCreating}
                    className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 resize-none outline-none transition-all"
                    placeholder="What is this team working on?"
                  />
                </div>
              </div>

              {/* Icon Picker */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground">
                  Icon
                </label>
                <div className="grid grid-cols-6 gap-3">
                  {TEAM_ICONS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setCreateIcon(item.id)}
                      type="button"
                      style={
                        createIcon === item.id
                          ? { backgroundColor: createColor }
                          : {}
                      }
                      className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                        createIcon === item.id
                          ? "border-2 border-primary text-white shadow-sm scale-105"
                          : "bg-white border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {item.icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-foreground">
                  Team Color
                </label>
                <div className="flex flex-wrap gap-3">
                  {TEAM_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setCreateColor(color)}
                      type="button"
                      style={{ backgroundColor: color }}
                      className={`w-8 h-8 rounded-full cursor-pointer transition-all ${
                        createColor === color
                          ? "ring-2 ring-offset-2 ring-primary scale-110"
                          : "hover:scale-110 hover:ring-2 hover:ring-offset-2 hover:ring-border"
                      }`}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="px-6 py-5 border-t border-border bg-secondary/30 flex justify-end gap-3 sticky bottom-0 z-10">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
                className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                disabled={isCreating || !createName.trim()}
                className="bg-primary hover:opacity-90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {isCreating ? "Creating..." : "Create Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddMemberModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative bg-white w-full max-w-md rounded-lg shadow-xl border border-border overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-foreground">Add Member</h2>
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setAddMemberError("");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {addMemberError && (
                <div className="p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4" />
                  <p>{addMemberError}</p>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-bold text-foreground"
                  htmlFor="am-full-name"
                >
                  Full Name *
                </label>
                <input
                  id="am-full-name"
                  type="text"
                  value={addForm.full_name}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  disabled={isAddingMember}
                  className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 py-2.5 outline-none transition-all"
                  placeholder="Jane Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-bold text-foreground"
                  htmlFor="am-email"
                >
                  Email *
                </label>
                <input
                  id="am-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, email: e.target.value }))
                  }
                  disabled={isAddingMember}
                  className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 py-2.5 outline-none transition-all"
                  placeholder="jane@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-bold text-foreground"
                  htmlFor="am-role"
                >
                  Role *
                </label>
                <div className="relative">
                  <select
                    id="am-role"
                    value={addForm.role}
                    onChange={(e) =>
                      setAddForm((f) => ({
                        ...f,
                        role: e.target.value as "dept_head" | "employee",
                      }))
                    }
                    disabled={isAddingMember}
                    className="w-full appearance-none rounded-lg border border-border bg-transparent text-foreground focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 pr-9 py-2.5 outline-none transition-all cursor-pointer disabled:opacity-60"
                  >
                    <option value="employee">Employee</option>
                    <option value="dept_head">Department Head</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none w-4 h-4 text-muted-foreground" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-bold text-foreground"
                  htmlFor="am-contact"
                >
                  Contact Number
                </label>
                <input
                  id="am-contact"
                  type="text"
                  value={addForm.contact_number || ""}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      contact_number: e.target.value,
                    }))
                  }
                  disabled={isAddingMember}
                  className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 py-2.5 outline-none transition-all"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  className="block text-sm font-bold text-foreground"
                  htmlFor="am-email2"
                >
                  Secondary Email
                </label>
                <input
                  id="am-email2"
                  type="email"
                  value={addForm.email_secondary || ""}
                  onChange={(e) =>
                    setAddForm((f) => ({
                      ...f,
                      email_secondary: e.target.value,
                    }))
                  }
                  disabled={isAddingMember}
                  className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 py-2.5 outline-none transition-all"
                  placeholder="jane.personal@example.com"
                />
              </div>
            </div>

            <div className="px-6 py-5 border-t border-border bg-secondary/30 flex justify-end gap-3 sticky bottom-0 z-10">
              <button
                onClick={() => {
                  setShowAddMemberModal(false);
                  setAddMemberError("");
                }}
                disabled={isAddingMember}
                className="px-5 py-2.5 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={
                  isAddingMember ||
                  !addForm.full_name.trim() ||
                  !addForm.email.trim()
                }
                className="bg-primary hover:opacity-90 text-primary-foreground px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isAddingMember ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {isAddingMember ? "Adding..." : "Add Member"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALL MEMBERS MODAL */}
      {showAllMembersModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="relative bg-white w-full max-w-2xl rounded-lg shadow-xl border border-border flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-border flex justify-between items-center bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-foreground">All Members</h2>
              <button
                onClick={() => setShowAllMembersModal(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 flex gap-2">
              {(["dept_head", "employee"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveMembersTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    activeMembersTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab === "dept_head" ? "Dept Heads" : "Employees"}
                  <span className="ml-1.5 text-xs opacity-70">
                    ({allMembers.filter((m) => m.role === tab).length})
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-4">
              {isLoadingAll ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {allMembers
                    .filter((m) => m.role === activeMembersTab)
                    .map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-4 p-3 rounded-lg border border-border/60 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                          {member.full_name?.charAt(0) || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {member.full_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.email}
                          </p>
                        </div>
                        <span
                          className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${
                            member.role === "dept_head"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-muted-foreground"
                          }`}
                        >
                          {member.role === "dept_head"
                            ? "Dept Head"
                            : "Employee"}
                        </span>
                        {!member.is_onboarded && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 flex-shrink-0">
                            Pending
                          </span>
                        )}
                      </div>
                    ))}
                  {allMembers.filter((m) => m.role === activeMembersTab)
                    .length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-12">
                      No{" "}
                      {activeMembersTab === "dept_head"
                        ? "department heads"
                        : "employees"}{" "}
                      found.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREDENTIALS POPUP */}
      {credentials && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-sm rounded-lg shadow-xl border border-border p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-lg font-bold text-foreground">
                Member Added!
              </h3>
            </div>

            <p className="text-sm text-muted-foreground">
              Share these credentials securely. The password is shown only once.
            </p>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Username / Email
                </label>
                <div className="flex items-center gap-2 p-2.5 bg-secondary rounded-lg border border-border">
                  <span className="flex-1 text-sm text-foreground font-mono truncate">
                    {credentials.username}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(credentials.username, "username")
                    }
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Copy"
                  >
                    {copiedField === "username" ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground uppercase tracking-wide">
                  Temporary Password
                </label>
                <div className="flex items-center gap-2 p-2.5 bg-secondary rounded-lg border border-border">
                  <span className="flex-1 text-sm text-foreground font-mono truncate">
                    {credentials.temporary_password}
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        credentials.temporary_password,
                        "password",
                      )
                    }
                    className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                    title="Copy"
                  >
                    {copiedField === "password" ? (
                      <Check className="w-4 h-4 text-primary" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCredentials(null)}
              className="w-full bg-primary hover:opacity-90 text-primary-foreground py-2.5 rounded-lg text-sm font-semibold transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
