import api from "@/lib/api";
import type {
  DailySummaryResponse,
  DeadStockItemResponse,
  MarginLeakageAlertResponse,
  BranchScorecardResponse,
  SellerPerformanceResponse,
} from "@/types";

type Range = { from?: string; to?: string; branchId?: string };

export const analyticsApi = {
  /** `date` defaults to today on the server; `branchId` narrows it to one branch. */
  dailySummary: (pharmacyId: string, params?: { date?: string; branchId?: string }) =>
    api.get<DailySummaryResponse>(`/api/v1/pharmacies/${pharmacyId}/analytics/daily-summary`, { params }).then((r) => r.data),

  deadStock: (pharmacyId: string, params?: { daysSinceLastSale?: number }) =>
    api.get<DeadStockItemResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/dead-stock`, { params }).then((r) => r.data),

  marginLeakage: (pharmacyId: string, params?: Range) =>
    api.get<MarginLeakageAlertResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/margin-leakage`, { params }).then((r) => r.data),

  branchScorecards: (pharmacyId: string, params?: Omit<Range, "branchId">) =>
    api.get<BranchScorecardResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/branch-scorecards`, { params }).then((r) => r.data),

  sellerPerformance: (pharmacyId: string, params?: Range) =>
    api.get<SellerPerformanceResponse[]>(`/api/v1/pharmacies/${pharmacyId}/analytics/seller-performance`, { params }).then((r) => r.data),
};
