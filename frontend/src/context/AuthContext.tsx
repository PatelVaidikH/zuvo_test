"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import api, { setTokens, clearTokens, getAccessToken } from "@/lib/api";
import { TOKEN_KEYS } from "@/lib/constants";
import type {
  User,
  LoginFormData,
  LoginResponse,
  TempPasswordLoginResponse,
  SetPasswordFormData,
  SetPasswordResponse,
  OnboardingFormData,
} from "@/types";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  tempToken: string | null;
}

interface AuthContextType extends AuthState {
  login: (data: LoginFormData) => Promise<{
    success: boolean;
    requiresPasswordChange?: boolean;
    requiresOnboarding?: boolean;
    error?: string;
  }>;
  logout: () => Promise<void>;
  setPassword: (data: SetPasswordFormData) => Promise<{
    success: boolean;
    requiresOnboarding?: boolean;
    error?: string;
  }>;
  refreshUser: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  completeOnboarding: (data: OnboardingFormData) => Promise<{
    success: boolean;
    error?: string;
  }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    tempToken: null,
  });

  const checkAuth = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setState({ user: null, isLoading: false, tempToken: null });
      return;
    }
    try {
      const response = await api.get("/users/me/");
      setState({ user: response.data, isLoading: false, tempToken: null });
    } catch {
      clearTokens();
      setState({ user: null, isLoading: false, tempToken: null });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (data: LoginFormData) => {
    try {
      const response = await api.post("/auth/login/", data);
      const resData = response.data;

      if (resData.requires_password_change) {
        const tempData = resData as TempPasswordLoginResponse;
        setState((prev) => ({ ...prev, tempToken: tempData.temp_token }));
        return { success: true, requiresPasswordChange: true };
      }

      const loginData = resData as LoginResponse;
      setTokens(loginData.access, loginData.refresh);
      setState({ user: loginData.user, isLoading: false, tempToken: null });
      return {
        success: true,
        requiresPasswordChange: false,
        requiresOnboarding: loginData.requires_onboarding,
      };
    } catch (error: any) {
      const message =
        error.response?.data?.errors?.non_field_errors?.[0] ||
        error.response?.data?.error ||
        "Login failed.";
      return { success: false, error: message };
    }
  };

  const setPassword = async (data: SetPasswordFormData) => {
    try {
      const response = await api.post("/auth/set-password/", data, {
        headers: { Authorization: `Bearer ${state.tempToken}` },
      });
      const resData = response.data as SetPasswordResponse;

      setTokens(resData.access, resData.refresh);
      setState({ user: resData.user, isLoading: false, tempToken: null });
      return { success: true, requiresOnboarding: resData.requires_onboarding };
    } catch (error: any) {
      const errors = error.response?.data?.errors;
      const message =
        errors?.current_password?.[0] ||
        errors?.new_password?.[0] ||
        errors?.confirm_password?.[0] ||
        errors?.non_field_errors?.[0] ||
        "Password change failed.";
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      const refreshToken = Cookies.get(TOKEN_KEYS.REFRESH);
      if (refreshToken)
        await api.post("/auth/logout/", { refresh: refreshToken });
    } catch {
    } finally {
      clearTokens();
      setState({ user: null, isLoading: false, tempToken: null });
      router.push("/login");
    }
  };

  const refreshUser = async () => {
    try {
      const response = await api.get("/users/me/");
      setState((prev) => ({ ...prev, user: response.data }));
    } catch {}
  };

  const updateUser = (updates: Partial<User>) => {
    setState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...updates } : null,
    }));
  };

  const completeOnboarding = async (data: OnboardingFormData) => {
    try {
      const response = await api.post("/users/onboarding/", data);
      setState((prev) => ({
        ...prev,
        user: response.data.user,
      }));
      return { success: true };
    } catch (error: any) {
      const message =
        error.response?.data?.errors?.job_title?.[0] ||
        error.response?.data?.errors?.full_name?.[0] ||
        error.response?.data?.error ||
        "Onboarding failed.";
      return { success: false, error: message };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        setPassword,
        refreshUser,
        updateUser,
        completeOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
