import api from "@/lib/api";
import type {
  Page,
  CustomerResponse,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  CustomerFavoriteResponse,
  RefillHistoryResponse,
} from "@/types";

export const customerApi = {
  create: (pharmacyId: string, data: CreateCustomerRequest) =>
    api.post<CustomerResponse>(`/api/v1/pharmacies/${pharmacyId}/customers`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; search?: string }) =>
    api.get<Page<CustomerResponse>>(`/api/v1/pharmacies/${pharmacyId}/customers`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, customerId: string) =>
    api.get<CustomerResponse>(`/api/v1/pharmacies/${pharmacyId}/customers/${customerId}`).then((r) => r.data),

  update: (pharmacyId: string, customerId: string, data: UpdateCustomerRequest) =>
    api.put<CustomerResponse>(`/api/v1/pharmacies/${pharmacyId}/customers/${customerId}`, data).then((r) => r.data),

  lookupByPhone: (pharmacyId: string, phone: string) =>
    api.get<CustomerResponse>(`/api/v1/pharmacies/${pharmacyId}/customers/phone/${phone}`).then((r) => r.data),

  favorites: (pharmacyId: string, customerId: string) =>
    api.get<CustomerFavoriteResponse[]>(`/api/v1/pharmacies/${pharmacyId}/customers/${customerId}/favorites`).then((r) => r.data),

  refills: (pharmacyId: string, customerId: string) =>
    api.get<RefillHistoryResponse[]>(`/api/v1/pharmacies/${pharmacyId}/customers/${customerId}/refills`).then((r) => r.data),
};
