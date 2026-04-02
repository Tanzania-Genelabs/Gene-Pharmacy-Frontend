import api from "@/lib/api";
import type { Page, ShiftResponse, OpenShiftRequest, CloseShiftRequest } from "@/types";

export const shiftApi = {
  open: (pharmacyId: string, data: OpenShiftRequest) =>
    api.post<ShiftResponse>(`/api/v1/pharmacies/${pharmacyId}/shifts`, data).then((r) => r.data),

  close: (pharmacyId: string, shiftId: string, data: CloseShiftRequest) =>
    api.put<ShiftResponse>(`/api/v1/pharmacies/${pharmacyId}/shifts/${shiftId}/close`, data).then((r) => r.data),

  getActive: (pharmacyId: string, branchId: string) =>
    api.get<ShiftResponse>(`/api/v1/pharmacies/${pharmacyId}/shifts/active`, { params: { branchId } }).then((r) => r.data),

  getById: (pharmacyId: string, shiftId: string) =>
    api.get<ShiftResponse>(`/api/v1/pharmacies/${pharmacyId}/shifts/${shiftId}`).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; branchId?: string; status?: string }) =>
    api.get<Page<ShiftResponse>>(`/api/v1/pharmacies/${pharmacyId}/shifts`, { params }).then((r) => r.data),
};
