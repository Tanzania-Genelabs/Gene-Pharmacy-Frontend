import api from "@/lib/api";
import type {
  Page,
  LoyaltyAccountResponse,
  LoyaltyTransactionResponse,
  RedeemPointsRequest,
} from "@/types";

export const loyaltyApi = {
  getAccount: (pharmacyId: string, customerId: string) =>
    api.get<LoyaltyAccountResponse>(`/api/v1/pharmacies/${pharmacyId}/loyalty/customer/${customerId}`).then((r) => r.data),

  getTransactions: (pharmacyId: string, customerId: string, params?: { page?: number; size?: number }) =>
    api.get<Page<LoyaltyTransactionResponse>>(`/api/v1/pharmacies/${pharmacyId}/loyalty/customer/${customerId}/transactions`, { params }).then((r) => r.data),

  redeem: (pharmacyId: string, customerId: string, data: RedeemPointsRequest) =>
    api.post<LoyaltyTransactionResponse>(`/api/v1/pharmacies/${pharmacyId}/loyalty/customer/${customerId}/redeem`, data).then((r) => r.data),
};
