"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { authApi } from "@/api/auth.api";
import { tokenStore } from "@/lib/tokens";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * On mount, silently restores session from the refresh-token cookie.
 * If successful, populates the Zustand auth store with the fresh
 * access token + user details. If failed, stays unauthenticated.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { setAuth, setInitializing } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    const restoreSession = async () => {
      const refreshToken = tokenStore.getRefreshToken();
      if (!refreshToken) {
        setInitializing(false);
        return;
      }

      try {
        const response = await authApi.refresh({ refreshToken });
        setAuth(response.user, response.accessToken, response.refreshToken);
      } catch {
        tokenStore.clearAll();
      } finally {
        setInitializing(false);
      }
    };

    restoreSession();
  }, [setAuth, setInitializing, router]);

  return <>{children}</>;
}
