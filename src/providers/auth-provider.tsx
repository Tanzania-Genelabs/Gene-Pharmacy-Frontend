"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/api/auth.api";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * On mount, silently restores the session from the httpOnly refresh cookie (via /api/session/refresh).
 * If it works, the auth store gets a fresh access token + user; otherwise the visitor stays signed out.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { setAuth, setInitializing } = useAuthStore();

  useEffect(() => {
    let cancelled = false;

    authApi
      .refresh()
      .then((response) => {
        if (!cancelled) setAuth(response.user, response.accessToken);
      })
      .catch(() => {
        // No cookie / expired session: stay unauthenticated.
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [setAuth, setInitializing]);

  return <>{children}</>;
}
