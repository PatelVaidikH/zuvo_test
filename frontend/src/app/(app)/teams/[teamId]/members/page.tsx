"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTeamMembers, useCompanyMembers } from "@/hooks/useApi";
import { getInitials } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  UserPlus,
  MoreVertical,
  Loader2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
  Settings,
  Users,
  ShieldCheck,
  UserMinus,
  CheckCircle2,
  Trash2,
} from "lucide-react";

const PAGE_SIZE = 10;

export default function TeamMembersPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const router = useRouter();

  const {
    members,
    teamName,
    isLoading,
    fetchMembers,
    addMembers,
    changeRole,
    removeMember,
  } = useTeamMembers(teamId);

  const {
    companyMembers,
    isLoading: membersSearchLoading,
    fetchCompanyMembers,
  } = useCompanyMembers();

  // ── Modal states ──
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Add Existing Member form ──
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [addTeamRole, setAddTeamRole] = useState<"dept_head" | "employee">(
    "employee",
  );
  const [addError, setAddError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");

  // ── Row dropdown ──
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Confirm remove dialog ──
  const [confirmRemove, setConfirmRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(members.length / PAGE_SIZE);
  const pagedMembers = members.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Fetch on mount ──
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // ── Fetch company members when add modal opens ──
  useEffect(() => {
    if (showAddModal) fetchCompanyMembers("", teamId);
  }, [showAddModal, fetchCompanyMembers, teamId]);

  // ── Debounced search ──
  useEffect(() => {
    if (!showAddModal) return;
    const t = setTimeout(() => fetchCompanyMembers(memberSearch, teamId), 300);
    return () => clearTimeout(t);
  }, [memberSearch, showAddModal, fetchCompanyMembers, teamId]);

  // ── Close menu on outside click ──
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Permissions ──
  const isAdmin = user?.role === "admin";
  const isDeptHeadOfTeam = members.some(
    (m) => m.user.id === user?.id && m.team_role === "dept_head",
  );
  const canManageMembers = isAdmin || isDeptHeadOfTeam;
  const hasDeptHead = members.some((m) => m.team_role === "dept_head");

  // ── Handlers ──
  const handleAddMember = async () => {
    if (selectedUserIds.length === 0) {
      setAddError("Please select at least one user.");
      return;
    }
    setIsAdding(true);
    setAddError("");
    const result = await addMembers(
      selectedUserIds.map((id) => ({ user_id: id, team_role: addTeamRole })),
    );
    setIsAdding(false);
    if (result.success) {
      setShowAddModal(false);
      setSelectedUserIds([]);
      setMemberSearch("");
      setAddTeamRole("employee");
      toast.success(
        selectedUserIds.length === 1
          ? "Member added to team"
          : `${selectedUserIds.length} members added to team`,
      );
    } else {
      setAddError(result.error || "Failed to add members.");
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setOpenMenuId(null);
    const memberName =
      members.find((m) => m.user.id === userId)?.user.full_name ?? "Member";
    const roleLabel = newRole === "dept_head" ? "Dept Head" : "Employee";
    const toastId = toast.loading(`Updating ${memberName}'s role…`);
    const result = await changeRole(userId, newRole);
    if (result.success) {
      toast.success(`${memberName} is now a ${roleLabel}`, { id: toastId });
    } else {
      toast.error(result.error || "Failed to change role.", { id: toastId });
    }
  };

  const handleRemoveMember = (userId: string, memberName: string) => {
    setOpenMenuId(null);
    setConfirmRemove({ userId, name: memberName });
  };

  const confirmRemoveMember = async () => {
    if (!confirmRemove) return;
    setIsRemoving(true);
    const toastId = toast.loading(`Removing ${confirmRemove.name}…`);
    const result = await removeMember(confirmRemove.userId);
    setIsRemoving(false);
    setConfirmRemove(null);
    if (result.success) {
      toast.success(`${confirmRemove.name} removed from team`, { id: toastId });
    } else {
      toast.error(result.error || "Failed to remove member.", { id: toastId });
    }
  };

  return (
    <div className="bg-background min-h-screen flex flex-col font-sans antialiased">
      {/* HEADER */}
      <header className="w-full px-8 pt-8 pb-0">
        {/* Top row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/home")}
              className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <span className="text-border">|</span>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {teamName || "Team Members"}
            </h1>
            <span className="text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              {members.length} {members.length === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        {/* Nav tabs + actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border gap-4">
          <nav className="flex gap-8">
            <span className="pb-3 text-primary border-b-2 border-primary font-medium text-sm flex items-center gap-1.5 cursor-default">
              <Users className="w-4 h-4" /> Members
            </span>
            <button
              onClick={() => router.push(`/teams/${teamId}/settings`)}
              className="pb-3 text-muted-foreground hover:text-foreground font-medium text-sm flex items-center gap-1.5 transition-colors border-b-2 border-transparent hover:border-border"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
          </nav>

          {canManageMembers && (
            <div className="pb-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 border border-border text-foreground hover:bg-secondary px-4 py-2 rounded-lg text-sm font-medium transition-all"
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            </div>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="grow w-full px-8 py-6 pb-16">
        {/* No dept head banner */}
        {!isLoading && !hasDeptHead && canManageMembers && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3.5">
            <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                No dept head assigned yet
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Add a department head to lead and manage this team.
              </p>
            </div>
            <button
              onClick={() => {
                setAddTeamRole("dept_head");
                setShowAddModal(true);
              }}
              className="shrink-0 text-xs font-semibold text-primary hover:text-primary/80 border border-primary/30 hover:border-primary/50 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap"
            >
              Add Dept Head
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="flex flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-border p-4 h-16 animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && members.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Users className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-foreground font-semibold">No members yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add existing company members to get started.
            </p>
          </div>
        )}

        {/* Member rows */}
        {!isLoading && members.length > 0 && (
          <>
            <div className="flex flex-col gap-2">
              {pagedMembers.map((m) => (
                <div
                  key={m.id}
                  className="bg-card rounded-lg border border-border p-4 flex items-center gap-4 group hover:shadow-sm transition-all"
                >
                  {/* Avatar + name/email — takes all remaining space */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                      {getInitials(m.user.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight truncate">
                        {m.user.full_name}
                        {m.user.id === user?.id && (
                          <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                            (you)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {m.user.email}
                      </p>
                    </div>
                  </div>

                  {/* Role badge — fixed width so all rows align */}
                  <div className="w-28 shrink-0">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        m.team_role === "dept_head"
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-secondary text-foreground/70 border-border"
                      }`}
                    >
                      {m.team_role === "dept_head" ? "Dept Head" : "Employee"}
                    </span>
                  </div>

                  {/* Status — fixed width so all rows align */}
                  <div className="w-28 shrink-0 flex items-center gap-2">
                    {m.user.is_password_temp ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="text-xs font-medium text-amber-600">
                          Pending Setup
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <span className="text-xs font-medium text-foreground">
                          Active
                        </span>
                      </>
                    )}
                  </div>

                  {/* Action menu — always reserve 32 px so every row stays aligned */}
                  <div
                    className="w-8 shrink-0 flex justify-end relative"
                    ref={openMenuId === m.id ? menuRef : null}
                  >
                    {canManageMembers && m.user.id !== user?.id && (
                      <>
                        <button
                          onClick={() =>
                            setOpenMenuId(openMenuId === m.id ? null : m.id)
                          }
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground p-1.5 rounded hover:bg-secondary transition-all"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>

                        {openMenuId === m.id && (
                          <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-lg shadow-lg py-1 min-w-40">
                            {m.team_role === "employee" ? (
                              <button
                                onClick={() =>
                                  handleChangeRole(m.user.id, "dept_head")
                                }
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                              >
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                Make Dept Head
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  handleChangeRole(m.user.id, "employee")
                                }
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                              >
                                <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                                Make Employee
                              </button>
                            )}
                            <div className="my-1 border-t border-border" />
                            <button
                              onClick={() =>
                                handleRemoveMember(m.user.id, m.user.full_name)
                              }
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              <UserMinus className="w-4 h-4" />
                              Remove from Team
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Showing {(page - 1) * PAGE_SIZE + 1}–
                  {Math.min(page * PAGE_SIZE, members.length)} of{" "}
                  {members.length} members
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                          page === p
                            ? "bg-primary text-primary-foreground"
                            : "border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {p}
                      </button>
                    ),
                  )}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ADD MEMBER MODAL */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-5 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold text-foreground">
                Add Members to Team
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddError("");
                  setSelectedUserIds([]);
                  setAddTeamRole("employee");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-6 py-4 bg-white">
              {addError && (
                <div className="flex items-center gap-2 p-3 mb-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {addError}
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Scrollable user list */}
            <div className="flex-1 overflow-y-auto max-h-80 px-2">
              <div className="flex flex-col">
                {membersSearchLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : companyMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No users available to add.
                  </p>
                ) : (
                  companyMembers.map((u) => {
                    const selected = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() =>
                          setSelectedUserIds((prev) =>
                            selected
                              ? prev.filter((id) => id !== u.id)
                              : [...prev, u.id],
                          )
                        }
                        className={`group flex items-center justify-between p-3 mx-4 my-1 rounded-lg cursor-pointer transition-colors text-left ${
                          selected
                            ? "bg-secondary border border-border/30"
                            : "border border-transparent hover:bg-[#F8F6F4] hover:border-border/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-bold text-foreground shrink-0">
                            {getInitials(u.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-foreground truncate">
                                {u.full_name}
                              </p>
                              {u.role === "dept_head" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary shrink-0">
                                  Dept Head
                                </span>
                              ) : u.role === "employee" ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground shrink-0">
                                  Employee
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {u.email}
                            </p>
                          </div>
                        </div>
                        {selected && (
                          <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white shadow-sm shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Footer: role toggle + add button */}
            <div className="px-6 py-5 border-t border-border bg-white flex items-center gap-4">
              {/* Segmented role control */}
              <div className="flex gap-1 w-1/2 p-1 bg-secondary rounded-lg">
                <button
                  type="button"
                  onClick={() => setAddTeamRole("employee")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    addTeamRole === "employee"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Employee
                </button>
                <button
                  type="button"
                  onClick={() => setAddTeamRole("dept_head")}
                  className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    addTeamRole === "dept_head"
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dept Head
                </button>
              </div>
              <button
                onClick={handleAddMember}
                disabled={isAdding || selectedUserIds.length === 0}
                className="w-1/2 flex justify-center items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isAdding && <Loader2 className="w-4 h-4 animate-spin" />}
                {isAdding
                  ? "Adding…"
                  : selectedUserIds.length > 0
                    ? `Add ${selectedUserIds.length} to Team`
                    : "Add to Team"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Remove Member Confirm Dialog ── */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-[1px]">
          <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Remove member
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    This will remove{" "}
                    <span className="font-medium text-foreground">
                      {confirmRemove.name}
                    </span>{" "}
                    from the team.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmRemove(null)}
                  disabled={isRemoving}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmRemoveMember}
                  disabled={isRemoving}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-destructive text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {isRemoving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
