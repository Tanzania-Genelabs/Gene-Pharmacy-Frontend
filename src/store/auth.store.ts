import { create } from "zustand";
import { tokenStore } from "@/lib/tokens";
import type { UserSummary } from "@/types";

export interface AuthState {
  user: UserSummary | null;
  pharmacyId: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;

  setAuth: (user: UserSummary, accessToken: string, refreshToken: string) => void;
  setPharmacyId: (id: string) => void;
  updateUser: (updates: Partial<UserSummary>) => void;
  clearAuth: () => void;
  setInitializing: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  pharmacyId: null,
  isAuthenticated: false,
  isInitializing: true,

  setAuth: (user, accessToken, refreshToken) => {
    tokenStore.setAccessToken(accessToken);
    tokenStore.setRefreshToken(refreshToken);
    set({
      user,
      pharmacyId: user.pharmacyId ?? null,
      isAuthenticated: true,
    });
  },

  setPharmacyId: (id) => set({ pharmacyId: id }),

  updateUser: (updates) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...updates } : null,
    })),

  clearAuth: () => {
    tokenStore.clearAll();
    set({ user: null, pharmacyId: null, isAuthenticated: false });
  },

  setInitializing: (val) => set({ isInitializing: val }),
}));
