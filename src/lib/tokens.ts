/**
 * In-memory access-token store.
 *
 * - Access token: lives ONLY in this JS closure (not localStorage, not a cookie). It survives SPA
 *   navigation and is lost on a full page reload, which silently restores it via /api/session/refresh.
 * - Refresh token: an httpOnly cookie set by the /api/session/* route handlers. Browser JavaScript
 *   cannot read it, so an XSS bug can't steal a long-lived credential.
 */
let _accessToken: string | null = null;

export const tokenStore = {
  getAccessToken(): string | null {
    return _accessToken;
  },

  setAccessToken(token: string): void {
    _accessToken = token;
  },

  clearAll(): void {
    _accessToken = null;
  },
};
