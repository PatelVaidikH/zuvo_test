import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";
import { API_URL, TOKEN_KEYS } from "./constants";

const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// ── Attach token to every request ──
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get(TOKEN_KEYS.ACCESS);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Auto-refresh on 401 ──
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      const refreshToken = Cookies.get(TOKEN_KEYS.REFRESH);

      if (!refreshToken) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        const response = await axios.post(`${API_URL}/auth/refresh/`, {
          refresh: refreshToken,
        });
        const newToken = response.data.access;
        Cookies.set(TOKEN_KEYS.ACCESS, newToken, { sameSite: "lax" });
        if (response.data.refresh) {
          Cookies.set(TOKEN_KEYS.REFRESH, response.data.refresh, { sameSite: "lax" });
        }
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as AxiosError, null);
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export function setTokens(access: string, refresh: string) {
  Cookies.set(TOKEN_KEYS.ACCESS, access, { sameSite: "lax" });
  Cookies.set(TOKEN_KEYS.REFRESH, refresh, { sameSite: "lax" });
}

export function clearTokens() {
  Cookies.remove(TOKEN_KEYS.ACCESS);
  Cookies.remove(TOKEN_KEYS.REFRESH);
}

export function getAccessToken(): string | undefined {
  return Cookies.get(TOKEN_KEYS.ACCESS);
}

export default api;