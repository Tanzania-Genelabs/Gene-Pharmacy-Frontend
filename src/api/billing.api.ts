import api from "@/lib/api";
import type {
  BillingOverview,
  Page,
  PayForSubscriptionRequest,
  RequestSubscriptionRequest,
  SubscriptionPaymentResponse,
} from "@/types";

const base = (pharmacyId: string) => `/api/v1/pharmacies/${pharmacyId}/subscription`;

export const billingApi = {
  overview: (pharmacyId: string) =>
    api.get<BillingOverview>(base(pharmacyId)).then((r) => r.data),

  /** Sends a mobile-money prompt to the owner's phone for the chosen plan and length. */
  pay: (pharmacyId: string, data: PayForSubscriptionRequest) =>
    api.post<SubscriptionPaymentResponse>(`${base(pharmacyId)}/payments`, data).then((r) => r.data),

  /** Says "I want this plan and I paid by mobile money / cash"; Gene Pharmacy confirms before access starts. */
  request: (pharmacyId: string, data: RequestSubscriptionRequest) =>
    api.post<SubscriptionPaymentResponse>(`${base(pharmacyId)}/requests`, data).then((r) => r.data),

  payments: (pharmacyId: string, params?: { page?: number; size?: number }) =>
    api.get<Page<SubscriptionPaymentResponse>>(`${base(pharmacyId)}/payments`, { params }).then((r) => r.data),

  /** Poll while the payment is Pending; the server checks with ClickPesa. */
  payment: (pharmacyId: string, paymentId: string) =>
    api.get<SubscriptionPaymentResponse>(`${base(pharmacyId)}/payments/${paymentId}`).then((r) => r.data),
};
