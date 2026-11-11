"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ymd } from "@/lib/periods";
import type { BusinessDay } from "@/types";

export const businessDayApi = {
  get: (pharmacyId: string, branchId?: string) =>
    api.get<BusinessDay>(`/api/v1/pharmacies/${pharmacyId}/business-day`, { params: { branchId: branchId || undefined } }).then((r) => r.data),
};

export const businessDayKey = (pharmacyId: string, branchId?: string) => ["business-day", pharmacyId, branchId || "all"];

/**
 * The shop's "today" (Y-m-d), as the server sees it. A shop still trading after midnight (open shift, or a day
 * cut-off such as 04:00) stays on the day it is working, so screens must not use this computer's calendar.
 * Until the server answers (or when it cannot be reached) the local calendar day is used.
 */
export function useBusinessToday(pharmacyId: string | undefined, branchId?: string): string {
  const { data } = useQuery({
    queryKey: businessDayKey(pharmacyId ?? "", branchId),
    queryFn: () => businessDayApi.get(pharmacyId!, branchId),
    enabled: !!pharmacyId,
    staleTime: 60_000,
    // Often enough to notice the day closing (shift closed, cut-off passed) without the page being reloaded.
    refetchInterval: 2 * 60_000,
    refetchOnWindowFocus: true,
  });
  return data?.date ?? ymd(new Date());
}
