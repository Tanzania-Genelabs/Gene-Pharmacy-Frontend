import api from "@/lib/api";
import { tokenStore } from "@/lib/tokens";
import type { AuthResponse, LoginRequest, RefreshTokenRequest, RegisterRequest, OwnerRegistrationRequest } from "@/types";

export const authApi = {
  login: (data: LoginRequest) =>
    api.post<AuthResponse>("/api/v1/auth/login", data).then((r) => r.data),

  refresh: (data: RefreshTokenRequest) =>
    api.post<AuthResponse>("/api/v1/auth/refresh", data).then((r) => r.data),

  logout: () => {
    const refreshToken = tokenStore.getRefreshToken();
    return api.post("/api/v1/auth/logout", { refreshToken }).then((r) => r.data);
  },

  register: (data: RegisterRequest) =>
    api.post<AuthResponse>("/api/v1/auth/register", data).then((r) => r.data),

  /** Public owner self-registration — no auth token required */
  registerOwner: (data: OwnerRegistrationRequest) =>
    api.post("/api/v1/auth/register/owner", data).then((r) => r.data),
};
