import api from "@/lib/api";
import type {
  Page,
  UserResponse,
  CreateStaffRequest,
  UpdateStaffRequest,
  ResetPasswordRequest,
  Role,
} from "@/types";

export const userApi = {
  // ── Self-profile (any role) ────────────────────────────────────────────────
  getSelf: (pharmacyId: string) =>
    api.get<UserResponse>(`/api/v1/pharmacies/${pharmacyId}/users/me`).then((r) => r.data),

  updateSelf: (pharmacyId: string, data: UpdateStaffRequest) =>
    api.put<UserResponse>(`/api/v1/pharmacies/${pharmacyId}/users/me`, data).then((r) => r.data),

  changeSelfPassword: (pharmacyId: string, data: ResetPasswordRequest) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/users/me/change-password`, data).then((r) => r.data),

  // ── Staff management (Owner / Manager) ────────────────────────────────────
  create: (pharmacyId: string, data: CreateStaffRequest) =>
    api.post<UserResponse>(`/api/v1/pharmacies/${pharmacyId}/users`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; role?: Role }) =>
    api.get<Page<UserResponse>>(`/api/v1/pharmacies/${pharmacyId}/users`, { params }).then((r) => r.data),

  listByBranch: (pharmacyId: string, branchId: string) =>
    api.get<UserResponse[]>(`/api/v1/pharmacies/${pharmacyId}/users/branch/${branchId}`).then((r) => r.data),

  getById: (pharmacyId: string, userId: string) =>
    api.get<UserResponse>(`/api/v1/pharmacies/${pharmacyId}/users/${userId}`).then((r) => r.data),

  update: (pharmacyId: string, userId: string, data: UpdateStaffRequest) =>
    api.put<UserResponse>(`/api/v1/pharmacies/${pharmacyId}/users/${userId}`, data).then((r) => r.data),

  delete: (pharmacyId: string, userId: string) =>
    api.delete(`/api/v1/pharmacies/${pharmacyId}/users/${userId}`).then((r) => r.data),

  reactivate: (pharmacyId: string, userId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/users/${userId}/reactivate`).then((r) => r.data),

  resetPassword: (pharmacyId: string, userId: string, data: ResetPasswordRequest) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/users/${userId}/reset-password`, data).then((r) => r.data),
};
