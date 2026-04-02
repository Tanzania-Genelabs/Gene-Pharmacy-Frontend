import api from "@/lib/api";
import type {
  Page,
  PaymentTransactionResponse,
  InitiatePaymentRequest,
} from "@/types";

export const paymentApi = {
  initiate: (pharmacyId: string, data: InitiatePaymentRequest) =>
    api.post<PaymentTransactionResponse>(`/api/v1/pharmacies/${pharmacyId}/payments`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; status?: string }) =>
    api.get<Page<PaymentTransactionResponse>>(`/api/v1/pharmacies/${pharmacyId}/payments`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, paymentId: string) =>
    api.get<PaymentTransactionResponse>(`/api/v1/pharmacies/${pharmacyId}/payments/${paymentId}`).then((r) => r.data),
};
