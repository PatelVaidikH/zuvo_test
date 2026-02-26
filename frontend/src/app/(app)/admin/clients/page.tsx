"use client";

import { cloneElement, useEffect, useState } from "react";
import { useClients, useClientUsers } from "@/hooks/useApi";
import type { CreateUserResponse } from "@/types";
import {
  Plus,
  Building2,
  FolderOpen,
  Mail,
  Filter,
  Download,
  ArrowDown,
  TrendingUp,
  X,
  Loader2,
  AlertCircle,
  ShieldAlert,
  KeyRound,
  Users,
  UsersRound,
  ChevronDown,
  Check,
  Info,
  Copy,
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  ShieldCheck,
  Pencil,
} from "lucide-react";

interface MetricCardProps {
  label: string;
  value: number | string;
  trend?: string;
  sub?: string;
  icon: React.ReactElement<{ className?: string }>;
  trendColor?: string;
}

function MetricCard({
  label,
  value,
  trend,
  sub,
  icon,
  trendColor = "text-primary",
}: MetricCardProps) {
  return (
    <div className="bg-card p-6 rounded-xl border border-border shadow-sm flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </p>
        <h3 className="text-3xl font-semibold mt-1 text-foreground">{value}</h3>
        {trend && (
          <p className={`text-xs ${trendColor} mt-2 flex items-center`}>
            <TrendingUp className="w-3 h-3 mr-1" /> {trend}
          </p>
        )}
        {sub && <p className="text-xs text-muted-foreground mt-2">{sub}</p>}
      </div>
      <div className="p-3 bg-secondary rounded-lg text-primary">
        {cloneElement(icon, { className: "w-6 h-6" })}
      </div>
    </div>
  );
}

export default function SuperAdminDashboard() {
  const {
    clients,
    isLoading,
    totalCount,
    fetchClients,
    createClient,
    updateClient,
    deactivateClient,
  } = useClients();

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState("");

  // ── Modal states ──
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [viewingClientId, setViewingClientId] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [credentialsPopup, setCredentialsPopup] =
    useState<CreateUserResponse | null>(null);

  // ── Create modal form state ──
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // ── Edit modal form state ──
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // ── Add user form state ──
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserContact, setNewUserContact] = useState("");
  const [newUserRole, setNewUserRole] = useState<"admin" | "dept_head">(
    "admin",
  );
  const [newUserEmailSecondary, setNewUserEmailSecondary] = useState("");
  const [addUserError, setAddUserError] = useState("");
  const [isAddingUser, setIsAddingUser] = useState(false);

  // ── Toast Notification State ──
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "info";
  } | null>(null);

  const showToast = (message: string, type: "success" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); // Auto-hide after 3 seconds
  };

  // ── Dropdown State for Three-Dot Menu ──
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // ── Confirmation Modal State ──
  const [confirmResetUserId, setConfirmResetUserId] = useState<string | null>(
    null,
  );

  // ── Client users hook (for viewing client detail) ──
  const {
    users: clientUsers,
    company: viewingCompany,
    isLoading: usersLoading,
    fetchUsers,
    createUser,
    resetUserPassword,
  } = useClientUsers(viewingClientId || "");

  // ── Fetch clients on mount ──
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // ── Search debounce ──
  useEffect(() => {
    const timer = setTimeout(() => fetchClients(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchClients]);

  // ── Fetch users when viewing a client ──
  useEffect(() => {
    if (viewingClientId) fetchUsers();
  }, [viewingClientId, fetchUsers]);

  // ── Close dropdown when clicking outside ──
  useEffect(() => {
    const handleClickOutside = () => setActiveDropdown(null);
    if (activeDropdown) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [activeDropdown]);

  // ══════════════════════════════════════
  //  HANDLERS — Wire these to your UI buttons
  // ══════════════════════════════════════

  // Create Company
  const handleCreateClient = async () => {
    if (!createName.trim()) {
      setCreateError("Company name is required.");
      return;
    }
    setIsCreating(true);
    setCreateError("");
    const result = await createClient({
      name: createName.trim(),
      description: createDescription.trim(),
    });
    if (result.success) {
      setShowCreateModal(false);
      setCreateName("");
      setCreateDescription("");
    } else {
      setCreateError(result.error || "Failed to create.");
    }
    setIsCreating(false);
  };

  // Open Edit Modal (pre-fill fields)
  const openEditModal = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setEditName(client.name);
      setEditDescription(client.description);
      setEditingClientId(clientId);
    }
  };

  // Save Edit
  const handleEditClient = async () => {
    if (!editingClientId || !editName.trim()) {
      setEditError("Name is required.");
      return;
    }
    setIsEditing(true);
    setEditError("");
    const result = await updateClient(editingClientId, {
      name: editName.trim(),
      description: editDescription.trim(),
    });
    if (result.success) {
      setEditingClientId(null);
    } else {
      setEditError(result.error || "Failed to update.");
    }
    setIsEditing(false);
  };

  // Deactivate Company
  const handleDeactivateClient = async () => {
    if (!editingClientId) return;
    if (
      !confirm(
        "Are you sure? This will deactivate the company and all its users.",
      )
    )
      return;
    const result = await deactivateClient(editingClientId);
    if (result.success) setEditingClientId(null);
  };

  // Open Client Detail (view users)
  const openClientDetail = (clientId: string) => {
    setViewingClientId(clientId);
  };

  // Add User to Company
  const handleAddUser = async () => {
    if (!newUserName.trim()) {
      setAddUserError("Name is required.");
      return;
    }
    if (!newUserEmail.trim()) {
      setAddUserError("Email is required.");
      return;
    }
    setIsAddingUser(true);
    setAddUserError("");
    const result = await createUser({
      full_name: newUserName.trim(),
      email: newUserEmail.trim().toLowerCase(),
      contact_number: newUserContact.trim(),
      role: newUserRole,
      email_secondary: newUserEmailSecondary.trim() || undefined,
    });
    if (result.success && result.result) {
      setShowAddUserModal(false);
      setCredentialsPopup(result.result); // Show credentials popup!
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserContact("");
      setNewUserRole("admin");
      setNewUserEmailSecondary("");
    } else {
      setAddUserError(result.error || "Failed to create user.");
    }
    setIsAddingUser(false);
  };

  // Reset User Password
  const handleResetPassword = async (userId: string) => {
    setConfirmResetUserId(userId);
    setActiveDropdown(null);
  };

  // Confirm and execute password reset
  const confirmPasswordReset = async () => {
    if (!confirmResetUserId) return;
    const result = await resetUserPassword(confirmResetUserId);
    if (result.success && result.result) {
      setCredentialsPopup(result.result); // Show new credentials
      showToast("New password generated successfully.", "success"); // Trigger Toast
    }
    setConfirmResetUserId(null);
  };

  // Copy Credentials to Clipboard
  const copyCredentials = () => {
    if (!credentialsPopup) return;
    const text = `Zuvo Login Credentials\nUsername: ${credentialsPopup.credentials.username}\nPassword: ${credentialsPopup.credentials.temporary_password}\nLogin: http://localhost:3000/login`;
    navigator.clipboard.writeText(text);
    showToast("Credentials copied to clipboard!", "success"); // Trigger Toast
  };

  return (
    <div className="font-sans text-foreground flex flex-col antialiased w-full">
      {/* Main Content Area */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-semibold text-foreground tracking-tight">
              Client Companies
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage your client roster, track status, and view details.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:opacity-90 text-white px-6 py-3 rounded-lg font-medium shadow-sm hover:shadow-md transition-all flex items-center gap-2 group"
          >
            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Create Client
          </button>
        </div>

        {/* Metrics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            label="Total Clients"
            value={totalCount}
            trend="+12% this month"
            icon={<Building2 />}
          />
          <MetricCard
            label="Active Projects"
            value="45"
            sub="Across 18 companies"
            icon={<FolderOpen />}
          />
          <MetricCard
            label="Pending Invites"
            value="8"
            trend="Action required"
            icon={<Mail />}
            trendColor="text-orange-600"
          />
        </div>

        {/* Table Container */}
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
          {/* Table Controls */}
          <div className="px-6 py-5 border-b border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 bg-secondary rounded-lg text-sm font-medium text-foreground border border-transparent">
                All Clients
              </button>
              <button className="px-4 py-2 bg-transparent rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Active
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-3 py-2 border border-border rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
              />
              <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                <Filter className="w-5 h-5" />
              </button>
              <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors">
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider group cursor-pointer">
                    Company Name{" "}
                    <ArrowDown className="inline w-3 h-3 opacity-0 group-hover:opacity-100" />
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Created Date
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Members
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider text-right">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      Loading clients...
                    </td>
                  </tr>
                ) : clients.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No companies found.
                    </td>
                  </tr>
                ) : (
                  clients.map((client) => (
                    <tr
                      key={client.id}
                      className="hover:bg-secondary/50 transition-colors group"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                            {client.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">
                              {client.name}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {client.description || "No description"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <span
                          className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${
                            client.is_active
                              ? "bg-primary/10 text-primary border-primary/10"
                              : "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${client.is_active ? "bg-primary" : "bg-muted-foreground"}`}
                          />
                          {client.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-sm text-foreground">
                        {new Date(client.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <div className="px-2 py-1 rounded bg-secondary text-[10px] font-bold text-muted-foreground">
                            {client.user_count} MEMBERS
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openClientDetail(client.id)}
                            className="p-2 text-muted-foreground hover:text-primary hover:bg-secondary rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(client.id)}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                            title="Edit Company"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-border bg-card flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing{" "}
              <span className="font-medium text-foreground">
                {clients.length}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{totalCount}</span>{" "}
              results
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 rounded border border-border text-xs font-medium text-muted-foreground disabled:opacity-50">
                Previous
              </button>
              <button className="px-3 py-1 rounded border border-border text-xs font-medium text-muted-foreground">
                Next
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Modals render based on state: */}
      {showCreateModal && (
        <div>
          {/* Create Client Modal */}
          <div
            aria-labelledby="modal-title"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
            role="dialog"
          >
            <div className="bg-white w-full max-w-lg mx-4 rounded-lg shadow-xl border border-border transform transition-all overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-border/50">
                <h3
                  className="text-xl font-semibold text-foreground"
                  id="modal-title"
                >
                  Create New Client
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError("");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                  type="button"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Body */}
              <div className="px-6 py-6 space-y-5">
                {/* Error Message */}
                {createError && (
                  <div className="p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" />
                    <p>{createError}</p>
                  </div>
                )}

                <div>
                  <label
                    className="block text-sm font-medium text-foreground mb-1.5"
                    htmlFor="company-name"
                  >
                    Company Name <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="company-name"
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    disabled={isCreating}
                    className="w-full rounded-md border border-border bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary sm:text-sm py-2.5 px-3 shadow-sm transition-all"
                    placeholder="e.g. Acme Studio"
                  />
                </div>

                <div>
                  <label
                    className="block text-sm font-medium text-foreground mb-1.5"
                    htmlFor="description"
                  >
                    Description / Remarks{" "}
                    <span className="text-muted-foreground font-normal ml-1">
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                    disabled={isCreating}
                    className="w-full rounded-md border-border bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary sm:text-sm py-2.5 px-3 shadow-sm resize-none transition-all"
                    placeholder="Add details about the client..."
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-secondary/30 flex items-center justify-end gap-3 border-t border-border/50">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateError("");
                  }}
                  disabled={isCreating}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-transparent border border-border rounded-lg hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-border transition-colors disabled:opacity-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateClient}
                  disabled={isCreating || !createName.trim()}
                  className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary shadow-sm transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  type="button"
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Client"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingClientId && (
        <div>
          {/* Edit Client Modal */}
          <div
            aria-labelledby="edit-modal-title"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 transition-opacity duration-300"
            role="dialog"
          >
            <div className="bg-white w-full max-w-lg rounded-lg shadow-xl border border-border flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-8 pt-8 pb-4 flex items-center justify-between">
                <h2
                  className="text-2xl font-semibold text-foreground tracking-tight"
                  id="edit-modal-title"
                >
                  Edit Client
                </h2>
                <button
                  onClick={() => setEditingClientId(null)}
                  className="p-1 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Form Body */}
              <div className="px-8 pb-8 space-y-6">
                {/* Error Message */}
                {editError && (
                  <div className="p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" />
                    <p>{editError}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-muted-foreground"
                    htmlFor="edit_company_name"
                  >
                    Company Name
                  </label>
                  <input
                    id="edit_company_name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    disabled={isEditing}
                    className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground/30"
                    placeholder="e.g. Acme Corp"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    className="text-sm font-medium text-muted-foreground"
                    htmlFor="edit_description"
                  >
                    Description / Remarks
                  </label>
                  <textarea
                    id="edit_description"
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    disabled={isEditing}
                    className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-foreground focus:ring-1 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-muted-foreground/30"
                    placeholder="Add details about the client..."
                  />
                </div>

                {/* Primary Actions */}
                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => setEditingClientId(null)}
                    className="px-6 py-2.5 border border-border text-muted-foreground font-medium rounded-lg hover:bg-secondary transition-colors"
                    disabled={isEditing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditClient}
                    disabled={isEditing || !editName.trim()}
                    className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-lg hover:opacity-90 transition-all shadow-sm flex items-center gap-2 disabled:opacity-70"
                  >
                    {isEditing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : null}
                    {isEditing ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Danger Zone / Deactivation Footer */}
              <div className="px-8 py-8 bg-secondary/30 border-t border-dashed border-destructive/30">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-destructive">
                      <ShieldAlert className="w-4 h-4" />
                      <h3 className="text-sm font-bold uppercase tracking-wider">
                        Deactivate this company
                      </h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-75">
                      This will suspend active projects and restrict member
                      access immediately.
                    </p>
                  </div>
                  <button
                    onClick={handleDeactivateClient}
                    className="whitespace-nowrap px-5 py-2.5 bg-destructive text-destructive-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                  >
                    Deactivate Company
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {viewingClientId && (
        <div>
          {/* Client Detail Popup Modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 transition-opacity duration-300"
            role="dialog"
            aria-modal="true"
          >
            <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl border border-border flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-border/50">
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    {viewingCompany?.name || "Loading..."}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {viewingCompany?.description || "Client Workspace"} • ID: #
                    {viewingClientId?.slice(0, 8).toUpperCase()}
                  </p>
                </div>
                <button
                  onClick={() => setViewingClientId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Content */}
              <div className="overflow-y-auto overflow-x-visible p-8 space-y-8">
                {/* Dynamic Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <DetailStatCard
                    label="Total Users"
                    value={viewingCompany?.user_count || 0}
                    icon={<Users className="w-4 h-4" />}
                  />
                  <DetailStatCard
                    label="Workspaces"
                    value="1"
                    icon={<UsersRound className="w-4 h-4" />}
                  />
                  <DetailStatCard
                    label="Status"
                    value={viewingCompany?.is_active ? "Active" : "Inactive"}
                    icon={<ShieldCheck className="w-4 h-4" />}
                    color={
                      viewingCompany?.is_active
                        ? "text-primary"
                        : "text-muted-foreground"
                    }
                  />
                </div>

                {/* Admin Users Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">
                      Admin Users
                    </h3>
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="bg-primary hover:opacity-90 text-white text-sm px-4 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 group"
                    >
                      <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                      Add User
                    </button>
                  </div>

                  <div className="border border-border rounded-lg bg-white">
                    {usersLoading ? (
                      <div className="p-12 flex flex-col items-center justify-center text-muted-foreground">
                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                        <p className="text-sm">Fetching team members...</p>
                      </div>
                    ) : clientUsers.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground">
                        <p className="text-sm">
                          No users found in this workspace.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-border/50 relative">
                        {clientUsers.map((clientUser) => (
                          <div
                            key={clientUser.id}
                            className="flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-primary border border-border overflow-hidden">
                                {clientUser.full_name.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-foreground">
                                  {clientUser.full_name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {clientUser.email}
                                </p>
                              </div>
                            </div>

                            <div className="hidden sm:block text-sm text-muted-foreground">
                              {clientUser.contact_number || "—"}
                            </div>

                            <div className="flex items-center gap-4">
                              <span className="px-3 py-1 bg-secondary text-foreground text-[10px] font-bold uppercase tracking-wider rounded-full border border-border">
                                {clientUser.role.replace("_", " ")}
                              </span>

                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveDropdown(
                                      activeDropdown === clientUser.id
                                        ? null
                                        : clientUser.id,
                                    );
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
                                  id={`dropdown-btn-${clientUser.id}`}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dropdown Menus Portal (rendered outside scrollable area) */}
              {activeDropdown &&
                clientUsers.map((clientUser) => {
                  if (activeDropdown !== clientUser.id) return null;

                  const btn = document.getElementById(
                    `dropdown-btn-${clientUser.id}`,
                  );
                  const rect = btn?.getBoundingClientRect();

                  return (
                    <div
                      key={`dropdown-${clientUser.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="fixed bg-card border border-border rounded-lg shadow-xl py-1 z-60 animate-in fade-in zoom-in-95 duration-100 w-48"
                      style={{
                        top: rect ? `${rect.bottom + 8}px` : "50%",
                        right: rect
                          ? `${window.innerWidth - rect.right}px`
                          : "50%",
                      }}
                    >
                      <button
                        onClick={() => handleResetPassword(clientUser.id)}
                        className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-secondary flex items-center gap-2 transition-colors"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-primary" />
                        Regenerate Credentials
                      </button>

                      <button className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Deactivate User
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {showAddUserModal && (
        <div>
          {/* Add User Modal */}
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-user-title"
          >
            <div className="w-full max-w-lg bg-card rounded-lg shadow-xl border border-border overflow-hidden transform transition-all animate-in zoom-in-95 duration-200">
              {/* Header */}
              <div className="px-6 py-5 border-b border-border/50 flex items-center justify-between">
                <h2
                  className="text-xl font-semibold text-foreground tracking-tight"
                  id="add-user-title"
                >
                  Add User to Workspace
                </h2>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setAddUserError("");
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <div className="px-6 py-6 space-y-5">
                {/* Error Message */}
                {addUserError && (
                  <div className="p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" />
                    <p>{addUserError}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor="full-name"
                  >
                    Full Name
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    disabled={isAddingUser}
                    className="block w-full rounded-md border-border bg-transparent shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3 placeholder:text-muted-foreground/40 transition-all outline-none"
                    placeholder="e.g. Jane Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor="email-primary"
                  >
                    Email (Primary)
                  </label>
                  <input
                    id="email-primary"
                    type="email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    disabled={isAddingUser}
                    className="block w-full rounded-md border-border bg-transparent shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3 placeholder:text-muted-foreground/40 transition-all outline-none"
                    placeholder="jane@zuvo.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor="contact-number"
                  >
                    Contact Number
                  </label>
                  <input
                    id="contact-number"
                    type="tel"
                    value={newUserContact}
                    onChange={(e) => setNewUserContact(e.target.value)}
                    disabled={isAddingUser}
                    className="block w-full rounded-md border-border bg-transparent shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3 placeholder:text-muted-foreground/40 transition-all outline-none"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor="role"
                  >
                    Role
                  </label>
                  <div className="relative">
                    <select
                      id="role"
                      value={newUserRole}
                      onChange={(e) =>
                        setNewUserRole(e.target.value as "admin" | "dept_head")
                      }
                      disabled={isAddingUser}
                      className="block w-full appearance-none rounded-md border-border bg-transparent shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 pl-3 pr-10 transition-all cursor-pointer outline-none"
                    >
                      <option value="admin">Administrator</option>
                      <option value="dept_head">Department Head</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    className="block text-sm font-medium text-foreground"
                    htmlFor="email-secondary"
                  >
                    Email (Secondary)
                  </label>
                  <input
                    id="email-secondary"
                    type="email"
                    value={newUserEmailSecondary}
                    onChange={(e) => setNewUserEmailSecondary(e.target.value)}
                    disabled={isAddingUser}
                    className="block w-full rounded-md border-border bg-transparent shadow-sm focus:border-primary focus:ring-1 focus:ring-primary text-sm py-2.5 px-3 placeholder:text-muted-foreground/40 transition-all outline-none"
                    placeholder="optional@email.com"
                  />
                </div>
              </div>

              {/* Footer Actions */}
              <div className="px-6 py-4 bg-secondary/30 border-t border-border/50 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setAddUserError("");
                  }}
                  disabled={isAddingUser}
                  className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-border transition-colors shadow-sm disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={
                    isAddingUser || !newUserName.trim() || !newUserEmail.trim()
                  }
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary transition-all shadow-sm flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isAddingUser ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {credentialsPopup && (
        <div>
          {/* Credentials Success Popup Modal */}
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            role="alertdialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-border overflow-hidden transform transition-all p-8 flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
              {/* Success Icon */}
              <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center mb-5 shadow-sm">
                <Check className="text-white w-8 h-8" />
              </div>

              <h2 className="text-2xl font-bold text-foreground tracking-tight mb-6">
                Credentials Generated
              </h2>

              {/* User Context Info */}
              <div className="w-full bg-secondary/30 border border-border rounded-lg p-4 text-left mb-6 space-y-3 shadow-sm">
                <div className="flex justify-between items-center border-b border-border/30 pb-2">
                  <span className="text-sm text-muted-foreground">User</span>
                  <span className="text-sm font-medium text-foreground">
                    {credentialsPopup.user.full_name}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Role</span>
                  <span className="text-sm font-medium text-foreground capitalize">
                    {credentialsPopup.user.role.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Secure Credentials Box */}
              <div className="w-full text-left mb-6">
                <h3 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
                  Security Credentials
                </h3>
                <div className="bg-secondary/50 rounded-lg p-4 border border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                    <span className="text-sm text-muted-foreground">
                      Username
                    </span>
                    <span className="font-mono text-sm font-bold text-foreground break-all">
                      {credentialsPopup.credentials.username}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <span className="text-sm text-muted-foreground">
                      Temporary Password
                    </span>
                    <span className="font-mono text-sm font-bold text-primary">
                      {credentialsPopup.credentials.temporary_password}
                    </span>
                  </div>
                </div>
              </div>

              {/* Security Warning */}
              <div className="w-full bg-destructive/5 border border-destructive/20 rounded-md p-3 mb-8 flex items-start gap-3">
                <AlertTriangle className="text-destructive w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium text-left leading-relaxed">
                  This password is shown only once. Share it securely with the
                  user. They will be forced to change it upon first login.
                </p>
              </div>

              {/* Footer Actions */}
              <div className="w-full flex justify-end gap-3">
                <button
                  onClick={copyCredentials}
                  className="px-5 py-2.5 bg-white border border-border rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-all shadow-sm flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={() => setCredentialsPopup(null)}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Password Reset */}
      {confirmResetUserId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-card rounded-lg shadow-xl border border-border overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Icon & Title */}
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <KeyRound className="w-7 h-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Regenerate Password?
              </h3>
              <p className="text-sm text-muted-foreground">
                This will generate a new temporary password for this user. The
                old password will no longer work.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setConfirmResetUserId(null)}
                className="flex-1 px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-all border border-border"
              >
                Cancel
              </button>
              <button
                onClick={confirmPasswordReset}
                className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-all shadow-sm"
              >
                Generate Password
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-9999 animate-in slide-in-from-right-8 fade-in duration-300">
          <div className="bg-card border border-border shadow-lg rounded-lg p-4 flex items-center gap-3 max-w-sm">
            {toast.type === "success" ? (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-primary" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-foreground" />
              </div>
            )}
            <p className="text-sm font-medium text-foreground">
              {toast.message}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface DetailStatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactElement;
  color?: string;
}

function DetailStatCard({
  label,
  value,
  icon,
  color = "text-foreground",
}: DetailStatCardProps) {
  return (
    <div className="bg-white p-5 rounded-lg border border-border flex flex-col items-center justify-center text-center shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-widest">
          {label}
        </span>
      </div>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
    </div>
  );
}
