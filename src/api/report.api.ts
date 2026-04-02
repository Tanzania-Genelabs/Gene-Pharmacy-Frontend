import api from "@/lib/api";
import type {
  SalesSummaryReport,
  DailySalesRow,
  TopDrugRow,
  PaymentBreakdownRow,
  InventorySummaryReport,
  PurchaseSummaryReport,
} from "@/types";

export const reportApi = {
  salesSummary: (pharmacyId: string, params: { from: string; to: string; branchId?: string }) =>
    api.get<SalesSummaryReport>(`/api/v1/pharmacies/${pharmacyId}/reports/sales/summary`, { params }).then((r) => r.data),

  salesDaily: (pharmacyId: string, params: { from: string; to: string; branchId?: string }) =>
    api.get<DailySalesRow[]>(`/api/v1/pharmacies/${pharmacyId}/reports/sales/daily`, { params }).then((r) => r.data),

  topDrugs: (pharmacyId: string, params: { from: string; to: string; limit?: number; branchId?: string }) =>
    api.get<TopDrugRow[]>(`/api/v1/pharmacies/${pharmacyId}/reports/sales/top-drugs`, { params }).then((r) => r.data),

  paymentMethods: (pharmacyId: string, params: { from: string; to: string; branchId?: string }) =>
    api
      .get<PaymentBreakdownRow[]>(`/api/v1/pharmacies/${pharmacyId}/reports/sales/payment-methods`, { params })
      .then((r) => r.data),

  inventorySummary: (pharmacyId: string, params?: { branchId?: string }) =>
    api
      .get<InventorySummaryReport>(`/api/v1/pharmacies/${pharmacyId}/reports/inventory/summary`, { params })
      .then((r) => r.data),

  purchaseSummary: (pharmacyId: string, params: { from: string; to: string }) =>
    api
      .get<PurchaseSummaryReport>(`/api/v1/pharmacies/${pharmacyId}/reports/purchases/summary`, { params })
      .then((r) => r.data),

  exportSales: (pharmacyId: string, format: "pdf" | "excel", params: { from: string; to: string; branchId?: string }) =>
    api
      .get<Blob>(`/api/v1/pharmacies/${pharmacyId}/reports/sales/export`, {
        params: { ...params, format: format === "excel" ? "xlsx" : format },
        responseType: "blob",
      })
      .then((r) => r.data),

  exportInventory: (pharmacyId: string, format: "pdf" | "excel", params?: { branchId?: string }) =>
    api
      .get<Blob>(`/api/v1/pharmacies/${pharmacyId}/reports/inventory/export`, {
        params: { ...params, format: format === "excel" ? "xlsx" : format },
        responseType: "blob",
      })
      .then((r) => r.data),
};
