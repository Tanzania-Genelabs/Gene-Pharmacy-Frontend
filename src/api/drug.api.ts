import api from "@/lib/api";
import type {
  Page,
  DrugResponse,
  CreateDrugRequest,
  UpdateDrugRequest,
  DrugImportResult,
  CategoryResponse,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@/types";

export const drugApi = {
  create: (pharmacyId: string, data: CreateDrugRequest) =>
    api.post<DrugResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: { page?: number; size?: number; search?: string }) =>
    api.get<Page<DrugResponse>>(`/api/v1/pharmacies/${pharmacyId}/drugs`, { params }).then((r) => r.data),

  getById: (pharmacyId: string, drugId: string) =>
    api.get<DrugResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs/${drugId}`).then((r) => r.data),

  update: (pharmacyId: string, drugId: string, data: UpdateDrugRequest) =>
    api.put<DrugResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs/${drugId}`, data).then((r) => r.data),

  delete: (pharmacyId: string, drugId: string) =>
    api.delete(`/api/v1/pharmacies/${pharmacyId}/drugs/${drugId}`).then((r) => r.data),

  reactivate: (pharmacyId: string, drugId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/drugs/${drugId}/reactivate`).then((r) => r.data),

  importExcel: (pharmacyId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api
      .post<DrugImportResult>(`/api/v1/pharmacies/${pharmacyId}/drugs/import`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((r) => r.data);
  },
};

export const drugCategoryApi = {
  create: (pharmacyId: string, data: CreateCategoryRequest) =>
    api.post<CategoryResponse>(`/api/v1/pharmacies/${pharmacyId}/drug-categories`, data).then((r) => r.data),

  list: (pharmacyId: string) =>
    api.get<CategoryResponse[]>(`/api/v1/pharmacies/${pharmacyId}/drug-categories`).then((r) => r.data),

  getById: (pharmacyId: string, categoryId: string) =>
    api.get<CategoryResponse>(`/api/v1/pharmacies/${pharmacyId}/drug-categories/${categoryId}`).then((r) => r.data),

  update: (pharmacyId: string, categoryId: string, data: UpdateCategoryRequest) =>
    api.put<CategoryResponse>(`/api/v1/pharmacies/${pharmacyId}/drug-categories/${categoryId}`, data).then((r) => r.data),

  delete: (pharmacyId: string, categoryId: string) =>
    api.delete(`/api/v1/pharmacies/${pharmacyId}/drug-categories/${categoryId}`).then((r) => r.data),

  reactivate: (pharmacyId: string, categoryId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/drug-categories/${categoryId}/reactivate`).then((r) => r.data),
};
