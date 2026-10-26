import api from "@/lib/api";
import { sessionClient } from "@/lib/session-client";
import type { AuthResponse, LoginRequest, RegisterRequest, OwnerRegistrationRequest } from "@/types";

export const authApi = {
  /** Signs in through the Next.js session proxy, which keeps the refresh token in an httpOnly cookie. */
  login: (data: LoginRequest) => sessionClient.login(data),

  /** Restores the session from the httpOnly cookie (no token is passed from JavaScript). */
  refresh: () => sessionClient.refresh(),

  logout: () => sessionClient.logout(),

  /** SuperAdmin only. Staff accounts are created through the pharmacy users API. */
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>("/api/v1/auth/register", data).then((r) => r.data),

  /** Public owner self-registration — no auth token required */
  registerOwner: (data: OwnerRegistrationRequest) =>
    api.post("/api/v1/auth/register/owner", data).then((r) => r.data),
};
