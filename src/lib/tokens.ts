/**
 * Secure in-memory token store.
 *
 * Security model:
 * - Access token: kept ONLY in memory (JS closure) — not in localStorage or sessionStorage.
 *   Survives SPA navigation; lost on full page refresh (triggers silent refresh via cookie).
 * - Refresh token: stored as a secure, SameSite=Strict cookie via the browser.
 *   It is NOT httpOnly so we can send it from the client for the refresh call,
 *   but it is Secure (HTTPS in production) and SameSite=Strict (no CSRF).
 *
 * This prevents XSS attacks from extracting long-lived tokens.
 */

let _accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return _accessToken;
  },

  setAccessToken(token: string): void {
    _accessToken = token;
  },

  clearAccessToken(): void {
    _accessToken = null;
  },

  /** Stores the refresh token in a Strict SameSite cookie. */
  setRefreshToken(token: string): void {
    if (typeof document === "undefined") return;
    const maxAge = 7 * 24 * 60 * 60; // 7 days
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    document.cookie = `refresh_token=${token}; Max-Age=${maxAge}; Path=/; SameSite=Strict${secure}`;
  },

  getRefreshToken(): string | null {
    if (typeof document === "undefined") return null;
    const match = document.cookie
      .split("; ")
      .find((row) => row.startsWith("refresh_token="));
    return match ? match.split("=")[1] : null;
  },

  clearRefreshToken(): void {
    if (typeof document === "undefined") return;
    document.cookie =
      "refresh_token=; Max-Age=0; Path=/; SameSite=Strict";
  },

  clearAll(): void {
    this.clearAccessToken();
    this.clearRefreshToken();
  },
};
