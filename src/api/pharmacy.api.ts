import api from "@/lib/api";
import type {
  Page,
  PharmacyResponse,
  CreatePharmacyRequest,
  UpdatePharmacyRequest,
  PharmacyStatus,
  PharmacyLimits,
} from "@/types";

export const pharmacyApi = {
  create: (data: CreatePharmacyRequest) =>
    api.post<PharmacyResponse>("/api/v1/pharmacies", data).then((r) => r.data),

  /** Returns the current owner's pharmacy, or null if not yet registered. */
  getMine: () =>
    api.get<PharmacyResponse>("/api/v1/pharmacies/mine")
      .then((r) => r.data)
      .catch((err) => {
        if (err?.response?.status === 204 || err?.response?.status === 404) return null;
        throw err;
      }),

  getById: (pharmacyId: string) =>
    api.get<PharmacyResponse>(`/api/v1/pharmacies/${pharmacyId}`).then((r) => r.data),

  update: (pharmacyId: string, data: UpdatePharmacyRequest) =>
    api.put<PharmacyResponse>(`/api/v1/pharmacies/${pharmacyId}`, data).then((r) => r.data),

  delete: (pharmacyId: string) =>
    api.delete(`/api/v1/pharmacies/${pharmacyId}`).then((r) => r.data),

  list: (params?: { status?: PharmacyStatus; page?: number; size?: number }) =>
    api.get<Page<PharmacyResponse>>("/api/v1/pharmacies", { params }).then((r) => r.data),

  approve: (pharmacyId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/approve`).then((r) => r.data),

  reject: (pharmacyId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/reject`).then((r) => r.data),

  suspend: (pharmacyId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/suspend`).then((r) => r.data),

  reactivate: (pharmacyId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/reactivate`).then((r) => r.data),

  /** SuperAdmin: the account / branch limits that apply to one pharmacy and how much it uses. */
  getLimits: (pharmacyId: string) =>
    api.get<PharmacyLimits>(`/api/v1/pharmacies/${pharmacyId}/limits`).then((r) => r.data),

  /** SuperAdmin: a number sets this pharmacy's own limit, null makes it unlimited, useDefault hands it back to the plan. */
  updateLimits: (
    pharmacyId: string,
    data: { maxUsers?: number | null; maxBranches?: number | null; useDefault?: ("maxUsers" | "maxBranches")[] },
  ) => api.put<PharmacyLimits>(`/api/v1/pharmacies/${pharmacyId}/limits`, data).then((r) => r.data),
};
