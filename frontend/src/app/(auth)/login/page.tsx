"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ArrowRight, Loader2, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  // ── State ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── Submit handler ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await login({ email, password });

      if (result.success) {
        if (result.requiresPasswordChange) {
          router.push("/reset-password");
        } else if (result.requiresOnboarding) {
          router.push("/onboarding");
        } else {
          router.push("/");
        }
      } else {
        setError(result.error || "Invalid email or password.");
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background font-sans antialiased">
      {/* Ambient background gradients using palette variables */}
      <div className="absolute inset-0 bg-linear-to-b from-white/40 to-transparent pointer-events-none" />

      {/* Decorative Illustration - Top Left */}
      <div className="fixed top-0 left-0 w-96 h-96 pointer-events-none opacity-30 -translate-x-1/3 -translate-y-1/3">
        <div className="w-full h-full rounded-full bg-linear-to-br from-border/60 to-transparent blur-3xl" />
      </div>

      {/* Main Card Container */}
      <main className="relative z-10 w-full max-w-105 p-4">
        <div className="bg-card rounded-lg border border-border shadow-[0_4px_24px_-12px_rgba(95,111,98,0.15)] overflow-hidden">
          <div className="p-8 md:p-10">
            {/* Header Section */}
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-12 h-12 bg-primary rounded flex items-center justify-center mb-6 shadow-sm">
                <span className="font-sans font-bold text-primary-foreground text-2xl">
                  Z
                </span>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2 tracking-tight">
                Welcome back
              </h1>
              <p className="text-muted-foreground text-sm">
                Sign in to your Zuvo workspace
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-3 rounded bg-destructive/10 border border-destructive/20 flex items-center gap-3 text-destructive text-sm animate-in fade-in slide-in-from-top-1">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* Login Form */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5"
              autoComplete="off"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="block text-[10px] font-bold text-foreground uppercase tracking-widest"
                >
                  Email
                </label>
                <div className="relative">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@company.com"
                    autoComplete="off"
                    className="block w-full rounded border border-border text-foreground shadow-sm placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm py-2.5 px-3 bg-white transition-all duration-200"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-[10px] font-bold text-foreground uppercase tracking-widest"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => router.push("/forgot-password")}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="off"
                    className="block w-full rounded border border-border text-foreground shadow-sm placeholder:text-muted-foreground/50 focus:border-primary focus:ring-1 focus:ring-primary sm:text-sm py-2.5 px-3 bg-white transition-all duration-200"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 rounded bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200 group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      Sign In
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Invite Only Footer */}
            <div className="mt-8 pt-6 border-t border-border/30">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="h-px w-8 bg-border" />
                <span className="text-[10px] font-bold tracking-[0.15em] text-muted-foreground uppercase">
                  Invite Only
                </span>
                <span className="h-px w-8 bg-border" />
              </div>
              <p className="text-center text-xs text-muted-foreground/80 leading-relaxed">
                Zuvo is currently in early access.
                <br />
                You need a workspace invite to join.
              </p>
            </div>
          </div>

          {/* Bottom decorative subtle texture bar */}
          <div className="h-1.5 w-full bg-secondary border-t border-border/50 opacity-50" />
        </div>

        {/* Outside Links */}
        <div className="mt-6 flex justify-center gap-6 text-xs text-muted-foreground">
          <Link href="/terms" className="hover:text-primary transition-colors">
            Terms
          </Link>
          <span className="text-border">•</span>
          <Link
            href="/privacy"
            className="hover:text-primary transition-colors"
          >
            Privacy
          </Link>
          <span className="text-border">•</span>
          <Link href="/help" className="hover:text-primary transition-colors">
            Help
          </Link>
        </div>
      </main>

      {/* Decorative Illustration - Bottom Right */}
      <div className="fixed bottom-0 right-0 w-64 h-64 pointer-events-none opacity-40 translate-x-1/3 translate-y-1/3">
        <div className="w-full h-full rounded-full bg-gradient-to-tr from-primary/20 to-transparent blur-3xl" />
      </div>
    </div>
  );
}
