import api from "@/lib/api";
import type { InventoryInsightsResponse, ProfitBreakdownResponse, ProfitGroup, SalesDaysResponse } from "@/types";

/** Day-by-day sales, profit breakdowns and stock insights. Dates are YYYY-MM-DD in the shop's own timezone. */
export const insightsApi = {
  /** Every day in the range that had sales, newest first. Profit and cost are null for Sellers. */
  salesDays: (pharmacyId: string, params: { from: string; to: string; branchId?: string }) =>
    api.get<SalesDaysResponse>(`/api/v1/pharmacies/${pharmacyId}/sales/days`, { params }).then((r) => r.data),

  /** Profit by day/week/month and by product (Owner and Manager only). */
  profitBreakdown: (pharmacyId: string, params: { from: string; to: string; branchId?: string; group: ProfitGroup }) =>
    api
      .get<ProfitBreakdownResponse>(`/api/v1/pharmacies/${pharmacyId}/reports/profit/breakdown`, { params })
      .then((r) => r.data),

  /** How much stock there is, what it is worth and what is running out (Owner and Manager only). */
  inventoryInsights: (pharmacyId: string, params?: { branchId?: string }) =>
    api
      .get<InventoryInsightsResponse>(`/api/v1/pharmacies/${pharmacyId}/inventory/insights`, { params })
      .then((r) => r.data),
};
