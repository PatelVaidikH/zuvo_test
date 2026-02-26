"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ROLE_HOME_ROUTES } from "@/lib/constants";

export default function RootPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace("/login"); return; }
    router.replace(ROLE_HOME_ROUTES[user.role] || "/home");
  }, [user, isLoading, router]);

  return null;
}