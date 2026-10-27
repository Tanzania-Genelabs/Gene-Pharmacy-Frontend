import axios, {
  AxiosError,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { tokenStore } from "@/lib/tokens";
import { sessionClient } from "@/lib/session-client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const SUBSCRIPTION_REQUIRED_EVENT = "gene:subscription-required";

/** Singleton Axios instance for all API calls. */
export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
  withCredentials: true,
});

// ─── Request interceptor — attach Bearer token ────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Response interceptor — silent refresh on 401 ────────────────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: AxiosError | null, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as AxiosRequestConfig & {
      _retry?: boolean;
    };

    // The pharmacy has no running subscription: the dashboard layout shows the "subscribe" screen.
    if (
      error.response?.status === 402 &&
      (error.response.data as { errorCode?: string } | undefined)?.errorCode === "SUBSCRIPTION_REQUIRED" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(new Event(SUBSCRIPTION_REQUIRED_EVENT));
    }

    const is401 = error.response?.status === 401;
    const isRefreshEndpoint = originalRequest.url?.includes("/auth/refresh");
    const alreadyRetried = originalRequest._retry;

    if (!is401 || isRefreshEndpoint || alreadyRetried) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        if (originalRequest.headers) {
          originalRequest.headers["Authorization"] = `Bearer ${token}`;
        }
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // The httpOnly refresh cookie is sent automatically; JavaScript never handles the token.
      const data = await sessionClient.refresh();

      tokenStore.setAccessToken(data.accessToken);
      processQueue(null, data.accessToken);

      if (originalRequest.headers) {
        originalRequest.headers["Authorization"] = `Bearer ${data.accessToken}`;
      }
      return api(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError as AxiosError, null);
      // Only a rejected session (401) means "sign in again"; an outage (503/network) keeps the cookie.
      if ((refreshError as AxiosError).response?.status === 401) {
        tokenStore.clearAll();
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
