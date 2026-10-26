import api from "@/lib/api";
import type { AuditFacets, AuditLogResponse, AuditLogSummaryResponse, Page } from "@/types";

export const auditLogApi = {
  list: (
    pharmacyId: string,
    params?: { page?: number; size?: number; action?: string; entityType?: string; from?: string; to?: string; search?: string }
  ) =>
    api.get<Page<AuditLogResponse>>(`/api/v1/pharmacies/${pharmacyId}/audit-logs`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, logId: string) =>
    api.get<AuditLogResponse>(`/api/v1/pharmacies/${pharmacyId}/audit-logs/${logId}`).then((r) => r.data),

  summary: (pharmacyId: string, params?: { from?: string; to?: string }) =>
    api
      .get<AuditLogSummaryResponse>(`/api/v1/pharmacies/${pharmacyId}/audit-logs/summary`, { params })
      .then((r) => r.data),

  /** The actions and entity types that really exist in this pharmacy's log. */
  facets: (pharmacyId: string) =>
    api.get<AuditFacets>(`/api/v1/pharmacies/${pharmacyId}/audit-logs/facets`).then((r) => r.data),
};
