import api from "@/lib/api";
import type {
  Page,
  SupplierResponse,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  RecordPaymentRequest,
  SupplierPaymentResponse,
} from "@/types";

export const supplierApi = {
  create: (pharmacyId: string, data: CreateSupplierRequest) =>
    api.post<SupplierResponse>(`/api/v1/pharmacies/${pharmacyId}/suppliers`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; search?: string }) =>
    api.get<Page<SupplierResponse>>(`/api/v1/pharmacies/${pharmacyId}/suppliers`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, supplierId: string) =>
    api.get<SupplierResponse>(`/api/v1/pharmacies/${pharmacyId}/suppliers/${supplierId}`).then((r) => r.data),

  update: (pharmacyId: string, supplierId: string, data: UpdateSupplierRequest) =>
    api.put<SupplierResponse>(`/api/v1/pharmacies/${pharmacyId}/suppliers/${supplierId}`, data).then((r) => r.data),

  delete: (pharmacyId: string, supplierId: string) =>
    api.delete(`/api/v1/pharmacies/${pharmacyId}/suppliers/${supplierId}`).then((r) => r.data),

  reactivate: (pharmacyId: string, supplierId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/suppliers/${supplierId}/reactivate`).then((r) => r.data),

  recordPayment: (pharmacyId: string, supplierId: string, data: RecordPaymentRequest) =>
    api
      .post<SupplierPaymentResponse>(`/api/v1/pharmacies/${pharmacyId}/suppliers/${supplierId}/payments`, data)
      .then((r) => r.data),

  listPayments: (pharmacyId: string, supplierId: string, params?: { page?: number; size?: number }) =>
    api
      .get<Page<SupplierPaymentResponse>>(`/api/v1/pharmacies/${pharmacyId}/suppliers/${supplierId}/payments`, { params })
      .then((r) => r.data),
};
