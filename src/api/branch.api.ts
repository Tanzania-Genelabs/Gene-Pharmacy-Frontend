import api from "@/lib/api";
import type { BranchResponse, CreateBranchRequest, UpdateBranchRequest } from "@/types";

export const branchApi = {
  create: (pharmacyId: string, data: CreateBranchRequest) =>
    api.post<BranchResponse>(`/api/v1/pharmacies/${pharmacyId}/branches`, data).then((r) => r.data),

  list: (pharmacyId: string) =>
    api.get<BranchResponse[]>(`/api/v1/pharmacies/${pharmacyId}/branches`).then((r) => r.data),

  getById: (pharmacyId: string, branchId: string) =>
    api.get<BranchResponse>(`/api/v1/pharmacies/${pharmacyId}/branches/${branchId}`).then((r) => r.data),

  update: (pharmacyId: string, branchId: string, data: UpdateBranchRequest) =>
    api.put<BranchResponse>(`/api/v1/pharmacies/${pharmacyId}/branches/${branchId}`, data).then((r) => r.data),

  delete: (pharmacyId: string, branchId: string) =>
    api.delete(`/api/v1/pharmacies/${pharmacyId}/branches/${branchId}`).then((r) => r.data),

  activate: (pharmacyId: string, branchId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/branches/${branchId}/activate`).then((r) => r.data),
};
