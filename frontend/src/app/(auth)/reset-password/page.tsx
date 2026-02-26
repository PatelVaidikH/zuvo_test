"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME_ROUTES } from "@/lib/constants";
import {
  Layers,
  LockKeyhole,
  Eye,
  EyeOff,
  CheckCircle2,
  Circle,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

export default function ResetPasswordPage() {
  const { setPassword, tempToken, user } = useAuth();
  const router = useRouter();

  // ── Form State ──
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // ── Password strength calculator ──
  const strength = useMemo(() => {
    const checks = {
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /[0-9]/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    };
    const score = Object.values(checks).filter(Boolean).length;
    const labels = ["", "Very weak", "Weak", "Fair", "Good", "Strong"];
    const colors = [
      "bg-border",
      "bg-red-400",
      "bg-orange-400",
      "bg-yellow-400",
      "bg-primary/70",
      "bg-primary",
    ];

    return { checks, score, label: labels[score], color: colors[score] };
  }, [newPassword]);

  // Security Redirect — only if not mid-completion
  if (!tempToken && !isCompleted) {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (strength.score < 4) {
      setError("Password is too weak. Please meet more requirements.");
      return;
    }

    setIsSubmitting(true);
    const result = await setPassword({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });

    if (result.success) {
      // Mark completed to prevent the tempToken guard from redirecting to /login
      setIsCompleted(true);

      if (result.requiresOnboarding) {
        router.push("/onboarding");
      } else {
        const homeRoute = ROLE_HOME_ROUTES[user?.role || "employee"] || "/home";
        router.push(homeRoute);
      }
    } else {
      setError(result.error || "Password change failed.");
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-background font-sans min-h-screen flex items-center justify-center p-4 antialiased">
      <main className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Brand / Logo Area */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center shadow-sm transform transition-transform group-hover:rotate-12">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-foreground tracking-tight">
              Zuvo
            </span>
          </div>
        </div>

        {/* Card Component */}
        <div className="bg-card rounded-xl border border-border shadow-sm p-8 sm:p-10 relative overflow-hidden">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Secure your account
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Please change your temporary password to continue accessing your
              workspace.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              <p>{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Temporary/Current Password Field */}
            <div className="space-y-1.5">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="current-password"
              >
                Temporary Password
              </label>
              <input
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="block w-full px-4 py-2.5 bg-transparent border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all sm:text-sm"
                placeholder="Enter current password"
              />
            </div>

            {/* New Password Field */}
            <div className="space-y-1.5">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="new-password"
              >
                New Password
              </label>
              <div className="relative group">
                <input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="block w-full px-4 py-2.5 bg-transparent border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all sm:text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Dynamic Strength Meter & Requirements */}
            <div className="bg-secondary/50 rounded-lg p-4 border border-border/30">
              <div className="flex justify-between items-center mb-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Security Level
                </p>
                <span
                  className={`text-[10px] font-bold uppercase ${strength.score >= 4 ? "text-primary" : "text-muted-foreground"}`}
                >
                  {strength.label}
                </span>
              </div>
              <div className="h-1 w-full bg-border/40 rounded-full mb-4 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${strength.color}`}
                  style={{ width: `${(strength.score / 5) * 100}%` }}
                />
              </div>

              <ul className="grid grid-cols-1 gap-2">
                <RequirementItem
                  met={strength.checks.length}
                  text="8+ characters"
                />
                <RequirementItem
                  met={strength.checks.uppercase && strength.checks.lowercase}
                  text="Case sensitive"
                />
                <RequirementItem
                  met={strength.checks.special || strength.checks.number}
                  text="Symbol or number"
                />
              </ul>
            </div>

            {/* Confirm Password Field */}
            <div className="space-y-1.5">
              <label
                className="block text-sm font-medium text-foreground"
                htmlFor="confirm-password"
              >
                Confirm New Password
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full px-4 py-2.5 bg-transparent border border-border rounded-lg text-foreground focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all sm:text-sm"
                placeholder="••••••••"
              />
            </div>

            {/* Action Button */}
            <button
              disabled={isSubmitting}
              className="w-full flex justify-center items-center gap-2 py-3 px-4 rounded-lg shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70"
              type="submit"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LockKeyhole className="w-4 h-4" />
                  Update Password
                </>
              )}
            </button>
          </form>

          {/* Footer Back Link */}
          <div className="mt-8 pt-6 border-t border-border/30 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to log in
            </Link>
          </div>
        </div>

        <p className="text-center mt-8 text-xs text-muted-foreground/60">
          © 2026 Zuvo Workspace. All rights reserved.
        </p>
      </main>
    </div>
  );
}

/** ── Sub-component for Requirements ── */
function RequirementItem({ met, text }: { met: boolean; text: string }) {
  return (
    <li
      className={`flex items-center gap-2 text-xs transition-colors duration-300 ${met ? "text-primary font-medium" : "text-muted-foreground/60"}`}
    >
      {met ? (
        <CheckCircle2 className="w-3.5 h-3.5" />
      ) : (
        <Circle className="w-3.5 h-3.5" />
      )}
      <span>{text}</span>
    </li>
  );
}
