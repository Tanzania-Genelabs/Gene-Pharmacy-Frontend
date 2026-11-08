"use client";

import { useMemo, useState } from "react";
import type { BranchResponse } from "@/types";

/**
 * The branch the dashboard shows ("" = all branches), remembered on this device per pharmacy and user.
 * The saved choice is read straight away so the first request already uses it; once the branch list is
 * known, a branch that was closed or removed is forgotten and the page falls back to all branches.
 */
export function useDashboardBranch(pharmacyId: string, userId: string | undefined, branches: BranchResponse[] | undefined) {
  const key = `gene:dashboard-branch:${pharmacyId}:${userId ?? ""}`;
  const [picked, setPicked] = useState<string | null>(null);

  const saved = useMemo(() => {
    try {
      return localStorage.getItem(key) ?? "";
    } catch {
      return "";
    }
  }, [key]);

  const wanted = picked ?? saved;
  const branchId = wanted && branches && !branches.some((b) => b.id === wanted && b.status === "Active") ? "" : wanted;

  function setBranchId(id: string) {
    setPicked(id);
    try {
      if (id) localStorage.setItem(key, id);
      else localStorage.removeItem(key);
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }

  return { branchId, setBranchId };
}
