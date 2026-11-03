import api from "@/lib/api";
import { sessionClient } from "@/lib/session-client";
import type { AuthResponse, LoginRequest, RegisterRequest, OwnerRegistrationRequest, TwoFactorStatus } from "@/types";

export const authApi = {
  /** Signs in through the Next.js session proxy, which keeps the refresh token in an httpOnly cookie. */
  login: (data: LoginRequest) => sessionClient.login(data),

  verifyTwoFactor: (challengeToken: string, code: string) => sessionClient.verifyTwoFactor(challengeToken, code),

  // ── Two-factor sign-in (SuperAdmin) ─────────────────────────────────────────
  twoFactorStatus: () => api.get<TwoFactorStatus>("/api/v1/auth/2fa").then((r) => r.data),
  twoFactorSetup: () => api.post<{ secret: string; otpauthUrl: string }>("/api/v1/auth/2fa/setup").then((r) => r.data),
  twoFactorEnable: (code: string) => api.post<{ recoveryCodes: string[] }>("/api/v1/auth/2fa/enable", { code }).then((r) => r.data),
  twoFactorDisable: (password: string, code: string) => api.post("/api/v1/auth/2fa/disable", { password, code }).then((r) => r.data),

  /** Restores the session from the httpOnly cookie (no token is passed from JavaScript). */
  refresh: () => sessionClient.refresh(),

  logout: () => sessionClient.logout(),

  /** Tells the server this person finished the guided setup, so they are not guided again. */
  completeOnboarding: () =>
    api.post<{ onboardingCompleted: boolean }>("/api/v1/auth/onboarding/complete").then((r) => r.data),

  /** SuperAdmin only. Staff accounts are created through the pharmacy users API. */
  register: (data: RegisterRequest) =>
    api.post<AuthResponse>("/api/v1/auth/register", data).then((r) => r.data),

  /** Public owner self-registration — no auth token required */
  registerOwner: (data: OwnerRegistrationRequest) =>
    api.post("/api/v1/auth/register/owner", data).then((r) => r.data),
};
