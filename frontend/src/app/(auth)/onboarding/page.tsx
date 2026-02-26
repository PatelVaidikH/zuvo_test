"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME_ROUTES } from "@/lib/constants";
import type { NotificationPreferences } from "@/types";

import {
  ChevronDown,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";

export default function OnboardingPage() {
  const { user, completeOnboarding } = useAuth();
  const router = useRouter();

  // ── Step tracking (1 = profile, 2 = preferences) ──
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Step 1: Profile data ──
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [jobTitle, setJobTitle] = useState("");
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  );

  const [notifications, setNotifications] = useState<NotificationPreferences>({
    task_assigned: true,
    mentioned: true,
    deadline_approaching: true,
    status_changes: false,
    new_team_member: false,
  });

  // Already onboarded? Redirect (must be in useEffect to avoid render-time side-effects).
  useEffect(() => {
    if (user?.is_onboarded) {
      router.push(ROLE_HOME_ROUTES[user.role] || "/home");
    }
  }, [user, router]);

  // Render nothing while redirect is in flight
  if (user?.is_onboarded) return null;

  // ── Step 1 → Step 2 ──
  const handleNextStep = () => {
    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!jobTitle.trim()) {
      setError("Job title is required.");
      return;
    }
    setError("");
    setStep(2);
  };

  // ── Step 2 → Complete ──
  const handleComplete = async () => {
    setIsSubmitting(true);
    setError("");

    const result = await completeOnboarding({
      full_name: fullName.trim(),
      job_title: jobTitle.trim(),
      timezone,
      notification_preferences: notifications,
    });

    if (result.success) {
      router.push(ROLE_HOME_ROUTES[user?.role || "employee"] || "/home");
    } else {
      setError(result.error || "Something went wrong.");
    }

    setIsSubmitting(false);
  };

  // ── Toggle a notification preference ──
  const toggleNotification = (key: keyof NotificationPreferences) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── YOUR STITCH UI GOES BELOW ──
  // Available for Step 1:
  //   step                    → current step (1 or 2), show step indicator
  //   fullName, setFullName   → name input (pre-filled)
  //   jobTitle, setJobTitle   → job title input
  //   timezone, setTimezone   → timezone dropdown
  //   avatarUrl, setAvatarUrl → avatar upload (just URL for now)
  //   user?.role              → read-only role badge
  //   error                   → error message
  //   handleNextStep          → "Continue →" button onClick
  //
  // Available for Step 2:
  //   notifications                         → object of booleans
  //   toggleNotification("task_assigned")   → toggle a switch
  //   isSubmitting                          → loading state
  //   error                                 → error message
  //   handleComplete                        → "Get Started →" button onClick
  //   () => setStep(1)                      → "← Back" button onClick

  return (
    <div>
      {step === 1 && (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background transition-colors duration-300">
          <main className="w-full max-w-lg mx-auto">
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col p-8 md:p-10 relative animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2 mb-10 w-full max-w-xs mx-auto">
                <div className="h-1.5 flex-1 rounded-full bg-primary" />
                <div className="h-1.5 flex-1 rounded-full border border-border bg-secondary/50" />
              </div>

              <div className="flex flex-col items-center w-full">
                <div className="text-center mb-8">
                  <h1 className="text-foreground text-3xl font-bold tracking-tight mb-2">
                    Let&apos;s set up your profile
                  </h1>
                </div>

                {error && (
                  <div className="w-full mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <form
                  className="w-full space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleNextStep();
                  }}
                >
                  {/* Role Badge */}
                  <div className="flex justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-secondary text-muted-foreground border border-border capitalize">
                      {user?.role ? user.role.replace("_", " ") : "New User"}
                    </span>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-5 mt-4">
                    <div className="group">
                      <label
                        className="block text-sm font-medium text-foreground mb-1.5"
                        htmlFor="full-name"
                      >
                        Full Name
                      </label>
                      <input
                        id="full-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                        placeholder="e.g. Jane Doe"
                      />
                    </div>

                    <div className="group">
                      <label
                        className="block text-sm font-medium text-foreground mb-1.5"
                        htmlFor="job-title"
                      >
                        Job Title / Designation
                      </label>
                      <input
                        id="job-title"
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200"
                        placeholder="e.g. Product Designer"
                      />
                    </div>

                    <div className="group">
                      <label
                        className="block text-sm font-medium text-foreground mb-1.5"
                        htmlFor="timezone"
                      >
                        Timezone
                      </label>
                      <div className="relative">
                        <select
                          id="timezone"
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full bg-transparent border border-border rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all duration-200 appearance-none pr-10 cursor-pointer"
                        >
                          {/* Common timezones. You can dynamically populate this list via Intl API if preferred */}
                          <option value="UTC">
                            UTC (Coordinated Universal Time)
                          </option>
                          <option value="America/New_York">
                            Eastern Time (US & Canada)
                          </option>
                          <option value="America/Chicago">
                            Central Time (US & Canada)
                          </option>
                          <option value="America/Denver">
                            Mountain Time (US & Canada)
                          </option>
                          <option value="America/Los_Angeles">
                            Pacific Time (US & Canada)
                          </option>
                          <option value="Europe/London">London</option>
                          <option value="Europe/Paris">
                            Central European Time
                          </option>
                          <option value="Asia/Kolkata">
                            India Standard Time
                          </option>
                          <option value="Asia/Tokyo">
                            Japan Standard Time
                          </option>
                          <option value="Australia/Sydney">
                            Australian Eastern Time
                          </option>
                        </select>
                        <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground">
                          <ChevronDown className="w-5 h-5" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full bg-primary hover:opacity-90 text-primary-foreground px-6 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground/60">
                © 2026 Zuvo Workspace Inc.
              </p>
            </div>
          </main>
        </div>
      )}
      {step === 2 && (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background transition-colors duration-300">
          <main className="w-full max-w-lg mx-auto">
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col p-8 md:p-10 relative animate-in fade-in slide-in-from-right-8 duration-500">
              {/* Progress Indicator */}
              <div className="flex items-center justify-center gap-2 mb-10 w-full max-w-xs mx-auto">
                <div className="h-1.5 flex-1 rounded-full border border-border bg-secondary/50" />
                <div className="h-1.5 flex-1 rounded-full bg-primary" />
              </div>

              <div className="flex flex-col items-center w-full">
                <div className="text-center mb-8">
                  <h1 className="text-foreground text-3xl font-bold tracking-tight mb-2">
                    Almost done!
                  </h1>
                  <p className="text-muted-foreground">
                    Customize your experience.
                  </p>
                </div>

                {error && (
                  <div className="w-full mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <form
                  className="w-full"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleComplete();
                  }}
                >
                  <div className="space-y-6">
                    <h2 className="text-lg font-medium text-foreground border-b border-border pb-2 mb-4">
                      Notification preferences
                    </h2>

                    {/* Render Toggles Dynamically based on State */}
                    {[
                      { id: "task_assigned", label: "Task assigned to me" },
                      { id: "mentioned", label: "@mentioned in comments" },
                      {
                        id: "deadline_approaching",
                        label: "Deadline approaching",
                      },
                      { id: "status_changes", label: "Status changes" },
                      {
                        id: "new_team_member",
                        label: "New team member joined",
                      },
                    ].map((pref) => (
                      <div
                        key={pref.id}
                        className="flex items-center justify-between group"
                      >
                        <label
                          className="text-foreground font-medium cursor-pointer"
                          htmlFor={pref.id}
                        >
                          {pref.label}
                        </label>

                        {/* Tailwind Native Toggle Switch */}
                        <button
                          type="button"
                          id={pref.id}
                          role="switch"
                          aria-checked={
                            notifications[
                              pref.id as keyof NotificationPreferences
                            ]
                          }
                          onClick={() =>
                            toggleNotification(
                              pref.id as keyof NotificationPreferences,
                            )
                          }
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                            notifications[
                              pref.id as keyof NotificationPreferences
                            ]
                              ? "bg-primary"
                              : "bg-border"
                          }`}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              notifications[
                                pref.id as keyof NotificationPreferences
                              ]
                                ? "translate-x-5"
                                : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-10 mt-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      disabled={isSubmitting}
                      className="text-muted-foreground hover:text-foreground font-medium transition-colors duration-200 px-2 py-2 disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="bg-primary hover:opacity-90 text-primary-foreground px-8 py-3 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 shadow-sm disabled:opacity-70 disabled:cursor-not-allowed min-w-[140px]"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          Get Started
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground/60">
                © 2026 Zuvo Workspace Inc.
              </p>
            </div>
          </main>
        </div>
      )}
    </div>
  );
}
