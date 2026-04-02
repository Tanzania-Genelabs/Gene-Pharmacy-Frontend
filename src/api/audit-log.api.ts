import api from "@/lib/api";
import type { Page, AuditLogResponse, AuditLogSummaryResponse } from "@/types";

export const auditLogApi = {
  list: (
    pharmacyId: string,
    params?: { page?: number; size?: number; action?: string; entityType?: string; userId?: string; from?: string; to?: string }
  ) =>
    api.get<Page<AuditLogResponse>>(`/api/v1/pharmacies/${pharmacyId}/audit-logs`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, logId: string) =>
    api.get<AuditLogResponse>(`/api/v1/pharmacies/${pharmacyId}/audit-logs/${logId}`).then((r) => r.data),

  summary: (pharmacyId: string, params?: { from?: string; to?: string }) =>
    api
      .get<AuditLogSummaryResponse>(`/api/v1/pharmacies/${pharmacyId}/audit-logs/summary`, { params })
      .then((r) => r.data),
};
