export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

export const TOKEN_KEYS = {
  ACCESS: "zuvo_access_token",
  REFRESH: "zuvo_refresh_token",
} as const;

export const PUBLIC_ROUTES = ["/login", "/reset-password", "/forgot-password"];

export const ROLE_HOME_ROUTES: Record<string, string> = {
  super_admin: "/admin/clients",
  admin: "/home",
  dept_head: "/home",
  employee: "/home",
};