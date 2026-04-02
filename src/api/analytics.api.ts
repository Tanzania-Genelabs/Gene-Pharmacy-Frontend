import api from "@/lib/api";
import type {
  DailySummaryResponse,
  DeadStockItemResponse,
  MarginLeakageAlertResponse,
  BranchScorecardResponse,
} from "@/types";

export const analyticsApi = {
  dailySummary: (pharmacyId: string) =>
    api.get<DailySummaryResponse>(`/api/v1/pharmacies/${pharmacyId}/analytics/daily-summary`).then((r) => r.data),

  deadStock: (pharmacyId: string, params?: { days?: number }) =>
    api.get<DeadStockItemResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/dead-stock`, { params }).then((r) => r.data),

  marginLeakage: (pharmacyId: string, params?: { from?: string; to?: string }) =>
    api.get<MarginLeakageAlertResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/margin-leakage`, { params }).then((r) => r.data),

  branchScorecards: (pharmacyId: string, params?: { from?: string; to?: string }) =>
    api.get<BranchScorecardResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/branch-scorecards`, { params }).then((r) => r.data),
};
