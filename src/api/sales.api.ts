import api from "@/lib/api";
import type { Page, SaleResponse, SaleSummaryResponse, CreateSaleRequest, VoidSaleRequest, MoveSalesDayResult, LateSaleRequest } from "@/types";

export const salesApi = {
  create: (pharmacyId: string, data: CreateSaleRequest) =>
    api.post<SaleResponse>(`/api/v1/pharmacies/${pharmacyId}/sales`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; branchId?: string; status?: string; from?: string; to?: string; paymentReference?: string; businessDate?: string; businessFrom?: string; businessTo?: string }) =>
    api.get<Page<SaleSummaryResponse>>(`/api/v1/pharmacies/${pharmacyId}/sales`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, saleId: string) =>
    api.get<SaleResponse>(`/api/v1/pharmacies/${pharmacyId}/sales/${saleId}`).then((r) => r.data),

  /** A seller asks for a sale to be recorded on an earlier day; nothing is sold until an owner or manager approves. */
  requestLate: (pharmacyId: string, data: CreateSaleRequest) =>
    api.post<LateSaleRequest>(`/api/v1/pharmacies/${pharmacyId}/sales/late-requests`, data).then((r) => r.data),

  /** A seller sees their own requests; owners and managers see everyone's. Pending first. */
  lateRequests: (pharmacyId: string) =>
    api.get<Page<LateSaleRequest>>(`/api/v1/pharmacies/${pharmacyId}/sales/late-requests`, { params: { page: 0, size: 100 } }).then((r) => r.data),

  approveLate: (pharmacyId: string, id: string) =>
    api.post<LateSaleRequest>(`/api/v1/pharmacies/${pharmacyId}/sales/late-requests/${id}/approve`, {}).then((r) => r.data),

  rejectLate: (pharmacyId: string, id: string, reason: string) =>
    api.post<LateSaleRequest>(`/api/v1/pharmacies/${pharmacyId}/sales/late-requests/${id}/reject`, { reason }).then((r) => r.data),

  /** Gene Pharmacy support only (inside a support session): count the chosen sales on another business day. */
  moveBusinessDay: (pharmacyId: string, data: { saleIds: string[]; targetDate: string; reason: string }) =>
    api.post<MoveSalesDayResult>(`/api/v1/pharmacies/${pharmacyId}/sales/move-business-day`, data).then((r) => r.data),

  void: (pharmacyId: string, saleId: string, data: VoidSaleRequest) =>
    api.post<SaleResponse>(`/api/v1/pharmacies/${pharmacyId}/sales/${saleId}/void`, data).then((r) => r.data),
};
