import axios from "axios";
import type { AuthResponse, LoginRequest } from "@/types";
import { tokenStore } from "@/lib/tokens";

/**
 * Same-origin calls to this app's own /api/session/* route handlers. The browser sends the httpOnly
 * refresh cookie automatically; JavaScript never sees it.
 */
const sessionHttp = axios.create({ baseURL: "", timeout: 20_000, headers: { "Content-Type": "application/json" } });

let inflightRefresh: Promise<AuthResponse> | null = null;

export const sessionClient = {
  login: (data: LoginRequest) => sessionHttp.post<AuthResponse>("/api/session/login", data).then((r) => r.data),

  /** One refresh at a time per tab: concurrent callers (React double-mount, parallel 401s) share it. */
  refresh: (): Promise<AuthResponse> => {
    inflightRefresh ??= sessionHttp
      .post<AuthResponse>("/api/session/refresh")
      .then((r) => r.data)
      .finally(() => {
        inflightRefresh = null;
      });
    return inflightRefresh;
  },

  logout: () => {
    const token = tokenStore.getAccessToken();
    return sessionHttp
      .post("/api/session/logout", null, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((r) => r.data);
  },
};
