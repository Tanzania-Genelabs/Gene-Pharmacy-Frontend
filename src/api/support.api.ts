import api from "@/lib/api";
import type { Announcement, Page, SupportRequest, SupportRequestKind } from "@/types";

/** The pharmacy side: ask Gene Pharmacy to correct something, and read Gene Pharmacy's notices. */
export const supportApi = {
  list: (pharmacyId: string, params?: { page?: number; size?: number }) =>
    api.get<Page<SupportRequest>>(`/api/v1/pharmacies/${pharmacyId}/support-requests`, { params }).then((r) => r.data),

  create: (
    pharmacyId: string,
    data: { kind: SupportRequestKind; message: string; branchId?: string; businessDate?: string; saleIds?: string[]; shiftId?: string },
  ) => api.post<SupportRequest>(`/api/v1/pharmacies/${pharmacyId}/support-requests`, data).then((r) => r.data),

  announcements: (pharmacyId: string) =>
    api.get<Announcement[]>(`/api/v1/pharmacies/${pharmacyId}/announcements`).then((r) => r.data),
};
