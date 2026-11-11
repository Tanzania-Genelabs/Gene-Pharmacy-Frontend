import api from "@/lib/api";
import type { Page, SaleResponse, SaleSummaryResponse, CreateSaleRequest, VoidSaleRequest, MoveSalesDayResult } from "@/types";

export const salesApi = {
  create: (pharmacyId: string, data: CreateSaleRequest) =>
    api.post<SaleResponse>(`/api/v1/pharmacies/${pharmacyId}/sales`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; branchId?: string; status?: string; from?: string; to?: string; paymentReference?: string; businessDate?: string; businessFrom?: string; businessTo?: string }) =>
    api.get<Page<SaleSummaryResponse>>(`/api/v1/pharmacies/${pharmacyId}/sales`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, saleId: string) =>
    api.get<SaleResponse>(`/api/v1/pharmacies/${pharmacyId}/sales/${saleId}`).then((r) => r.data),

  /** Gene Pharmacy support only (inside a support session): count the chosen sales on another business day. */
  moveBusinessDay: (pharmacyId: string, data: { saleIds: string[]; targetDate: string; reason: string }) =>
    api.post<MoveSalesDayResult>(`/api/v1/pharmacies/${pharmacyId}/sales/move-business-day`, data).then((r) => r.data),

  void: (pharmacyId: string, saleId: string, data: VoidSaleRequest) =>
    api.post<SaleResponse>(`/api/v1/pharmacies/${pharmacyId}/sales/${saleId}/void`, data).then((r) => r.data),
};
