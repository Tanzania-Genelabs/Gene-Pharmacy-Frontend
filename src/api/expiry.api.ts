import api from "@/lib/api";
import type {
  Page,
  StockBatchResponse,
  CreateStockBatchRequest,
  ExpiryDashboardResponse,
  NearExpiryItemResponse,
  ReorderRecommendationResponse,
} from "@/types";

export const expiryApi = {
  /** Get the expiry dashboard overview. */
  dashboard: (pharmacyId: string) =>
    api.get<ExpiryDashboardResponse>(`/api/v1/pharmacies/${pharmacyId}/expiry/dashboard`).then((r) => r.data),

  /** List near-expiry items with markdown pricing. */
  nearExpiry: (pharmacyId: string, params?: { days?: number }) =>
    api.get<NearExpiryItemResponse[]>(`/api/v1/pharmacies/${pharmacyId}/expiry/near-expiry`, { params }).then((r) => r.data),

  /** Register a new stock batch. */
  registerBatch: (pharmacyId: string, data: CreateStockBatchRequest) =>
    api.post<StockBatchResponse>(`/api/v1/pharmacies/${pharmacyId}/expiry/batches`, data).then((r) => r.data),

  /** List all batches (optionally filtered by drug or branch). */
  listBatches: (pharmacyId: string, params?: { page?: number; size?: number; drugId?: string; branchId?: string }) =>
    api.get<Page<StockBatchResponse>>(`/api/v1/pharmacies/${pharmacyId}/expiry/batches`, { params }).then((r) => r.data),

  /** Get smart reorder recommendations. */
  reorderRecommendations: (pharmacyId: string) =>
    api.get<ReorderRecommendationResponse[]>(`/api/v1/pharmacies/${pharmacyId}/expiry/reorder-recommendations`).then((r) => r.data),
};
