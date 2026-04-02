import api from "@/lib/api";
import type {
  Page,
  PurchaseOrderResponse,
  PurchaseOrderSummaryResponse,
  CreatePurchaseOrderRequest,
  ReceiveItemRequest,
} from "@/types";

export const purchaseOrderApi = {
  create: (pharmacyId: string, data: CreatePurchaseOrderRequest) =>
    api
      .post<PurchaseOrderResponse>(`/api/v1/pharmacies/${pharmacyId}/purchase-orders`, data)
      .then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; status?: string; supplierId?: string }) =>
    api
      .get<Page<PurchaseOrderSummaryResponse>>(`/api/v1/pharmacies/${pharmacyId}/purchase-orders`, { params })
      .then((r) => r.data),

  getById: (pharmacyId: string, orderId: string) =>
    api
      .get<PurchaseOrderResponse>(`/api/v1/pharmacies/${pharmacyId}/purchase-orders/${orderId}`)
      .then((r) => r.data),

  confirm: (pharmacyId: string, orderId: string) =>
    api
      .post<PurchaseOrderResponse>(`/api/v1/pharmacies/${pharmacyId}/purchase-orders/${orderId}/confirm`)
      .then((r) => r.data),

  cancel: (pharmacyId: string, orderId: string) =>
    api
      .post<PurchaseOrderResponse>(`/api/v1/pharmacies/${pharmacyId}/purchase-orders/${orderId}/cancel`)
      .then((r) => r.data),

  receiveItems: (pharmacyId: string, orderId: string, items: ReceiveItemRequest[]) =>
    api
      .post<PurchaseOrderResponse>(`/api/v1/pharmacies/${pharmacyId}/purchase-orders/${orderId}/receive`, { items })
      .then((r) => r.data),
};
