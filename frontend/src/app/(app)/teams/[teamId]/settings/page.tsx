"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useTeams } from "@/hooks/useApi";
import api from "@/lib/api";
import type { TeamDetail } from "@/types";
import {
  ArrowLeft,
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
  MoreHorizontal,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  ArchiveX,
} from "lucide-react";

const TEAM_COLORS = [
  "#5F6F62",
  "#a67c52",
  "#E5E0D8",
  "#64748B",
  "#818CF8",
  "#7E7A75",
  "#DCD7CE",
  "#2C2C2C",
];

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

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { updateTeam, archiveTeam } = useTeams();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(TEAM_ICONS[0].id);
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchTeam = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/teams/${teamId}/`);
        const t = res.data.team;
        setTeam(t);
        setName(t.name);
        setDescription(t.description || "");
        setIcon(t.icon || TEAM_ICONS[0].id);
        setColor(t.color || TEAM_COLORS[0]);
      } catch {
        router.push("/home");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTeam();
  }, [teamId, router]);

  const isAdmin = user?.role === "admin";
  const isDeptHeadOfTeam = team?.members?.some(
    (m) => m.user.id === user?.id && m.team_role === "dept_head",
  );
  const canEdit = isAdmin || isDeptHeadOfTeam;
  const canArchive = isAdmin;

  const hasChanges =
    team &&
    (name !== team.name ||
      description !== (team.description || "") ||
      icon !== team.icon ||
      color !== team.color);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Team name is required.");
      return;
    }
    setIsSaving(true);
    setError("");
    setSaveSuccess(false);
    const result = await updateTeam(teamId, {
      name: name.trim(),
      description: description.trim(),
      icon,
      color,
    });
    if (result.success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } else {
      setError(result.error || "Failed to save changes.");
    }
    setIsSaving(false);
  };

  const handleArchive = async () => {
    if (
      !confirm(`Archive "${team?.name}"? Members will lose access immediately.`)
    )
      return;
    const result = await archiveTeam(teamId);
    if (result.success) router.push("/home");
  };

  return (
    <div className="bg-background min-h-screen flex flex-col font-sans antialiased">
      {/* HEADER */}
      <header className="w-full px-8 pt-8 pb-0">
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
              {isLoading ? "Loading…" : team?.name || "Team Settings"}
            </h1>
          </div>
        </div>

        {/* Nav tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-border gap-4">
          <nav className="flex gap-8">
            <button
              onClick={() => router.push(`/teams/${teamId}/members`)}
              className="pb-3 text-muted-foreground hover:text-foreground font-medium text-sm flex items-center gap-1.5 transition-colors border-b-2 border-transparent hover:border-border"
            >
              <Users className="w-4 h-4" /> Members
            </button>
            <span className="pb-3 text-primary border-b-2 border-primary font-medium text-sm flex items-center gap-1.5 cursor-default">
              <Settings className="w-4 h-4" /> Settings
            </span>
          </nav>
        </div>
      </header>

      {/* MAIN */}
      <main className="grow w-full px-8 py-8 pb-16">
        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (
          <div className="flex items-start gap-8">
            {/* Settings form card */}
            <div className="flex-1 max-w-2xl bg-white rounded-lg border border-border p-8 shadow-sm">
              <form
                className="flex flex-col gap-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSave();
                }}
              >
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                {saveSuccess && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Changes saved successfully.
                  </div>
                )}

                {/* Team Name */}
                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-bold text-foreground"
                    htmlFor="team-name"
                  >
                    Team Name
                  </label>
                  <input
                    id="team-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!canEdit || isSaving}
                    className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 py-2.5 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="e.g. Engineering"
                  />
                </div>

                {/* Description */}
                <div className="flex flex-col gap-2">
                  <label
                    className="text-sm font-bold text-foreground"
                    htmlFor="team-description"
                  >
                    Description
                  </label>
                  <textarea
                    id="team-description"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!canEdit || isSaving}
                    className="w-full rounded-lg border border-border bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:ring-1 focus:ring-primary text-sm px-3 py-2.5 outline-none resize-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    placeholder="What is this team working on?"
                  />
                </div>

                {/* Icon picker */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-foreground">
                    Icon
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {TEAM_ICONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => canEdit && setIcon(item.id)}
                        disabled={!canEdit || isSaving}
                        style={
                          icon === item.id ? { backgroundColor: color } : {}
                        }
                        className={`aspect-square rounded-lg flex items-center justify-center transition-all disabled:cursor-not-allowed ${
                          icon === item.id
                            ? "border-2 border-primary text-white shadow-sm scale-105"
                            : "bg-white border border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color picker */}
                <div className="flex flex-col gap-3">
                  <label className="text-sm font-bold text-foreground">
                    Team Color
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {TEAM_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => canEdit && setColor(c)}
                        disabled={!canEdit || isSaving}
                        style={{ backgroundColor: c }}
                        className={`w-8 h-8 rounded-full transition-all disabled:cursor-not-allowed ${
                          color === c
                            ? "ring-2 ring-offset-2 ring-primary scale-110"
                            : "hover:scale-110 hover:ring-2 hover:ring-offset-2 hover:ring-border"
                        }`}
                        aria-label={`Select color ${c}`}
                      />
                    ))}
                  </div>
                </div>

                {/* Save */}
                {canEdit && (
                  <div className="pt-2 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={isSaving || !hasChanges}
                      className="flex items-center gap-2 bg-primary hover:opacity-90 text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {isSaving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </form>
            </div>

            {/* Danger zone — archive (right column) */}
            {canArchive && (
              <div className="w-80 shrink-0 border border-dashed border-destructive rounded-lg p-6 bg-white/50">
                <div className="flex items-start gap-3 mb-4">
                  <ArchiveX className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                  <div>
                    <h3 className="text-base font-bold text-destructive">
                      Archive this team
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Archiving will remove this team from the active workspace.
                      All associated projects and tasks will be hidden. Active
                      members will lose access immediately. You can unarchive it
                      later from workspace settings.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleArchive}
                  className="flex items-center gap-2 bg-destructive hover:opacity-90 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition-all"
                >
                  <ArchiveX className="w-4 h-4" />
                  Archive Team
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
