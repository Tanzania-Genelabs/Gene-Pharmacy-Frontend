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
  DrugListParams,
  DrugBulkChanges,
  DrugBulkResult,
  DrugPriceRow,
  DuplicatesResponse,
  SimilarDrug,
  MergeDrugsResult,
  FromCatalogRequest,
  FromCatalogResult,
} from "@/types";

/**
 * The server sends prices as exact decimal strings ("2500.00"). The screens do arithmetic and number
 * formatting on them, so convert once here instead of in every component.
 */
function normalizeDrug(drug: DrugResponse): DrugResponse {
  return {
    ...drug,
    sellingPrice: Number(drug.sellingPrice),
    allowsHalfDose: Boolean(drug.allowsHalfDose),
    halfDosePrice: drug.halfDosePrice === null || drug.halfDosePrice === undefined ? null : Number(drug.halfDosePrice),
    buyingPrice: drug.buyingPrice === null || drug.buyingPrice === undefined ? null : Number(drug.buyingPrice),
  };
}

export const drugApi = {
  create: (pharmacyId: string, data: CreateDrugRequest) =>
    api.post<DrugResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs`, data).then((r) => normalizeDrug(r.data)),

  list: (pharmacyId: string, params?: DrugListParams) =>
    api
      .get<Page<DrugResponse>>(`/api/v1/pharmacies/${pharmacyId}/drugs`, { params })
      .then((r) => ({ ...r.data, content: r.data.content.map(normalizeDrug) })),

  /** Same change for many drugs at once (Owner/Manager). */
  bulkUpdate: (pharmacyId: string, ids: string[], changes: DrugBulkChanges) =>
    api.post<DrugBulkResult>(`/api/v1/pharmacies/${pharmacyId}/drugs/bulk-update`, { ids, changes }).then((r) => r.data),

  /** Own price per drug, many drugs at once (Owner/Manager). */
  bulkPrices: (pharmacyId: string, rows: DrugPriceRow[]) =>
    api.post<DrugBulkResult>(`/api/v1/pharmacies/${pharmacyId}/drugs/bulk-prices`, { rows }).then((r) => r.data),

  duplicates: (pharmacyId: string) =>
    api.get<DuplicatesResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs/duplicates`).then((r) => r.data),

  /** Drugs that look like the one about to be created (never blocks creating). */
  similar: (pharmacyId: string, params: { name?: string; brand?: string; barcode?: string }) =>
    api.get<SimilarDrug[]>(`/api/v1/pharmacies/${pharmacyId}/drugs/similar`, { params }).then((r) => r.data),

  /** Moves stock and history of `mergeIds` into `keepId`; the merged drugs are switched off. */
  merge: (pharmacyId: string, keepId: string, mergeIds: string[]) =>
    api
      .post<MergeDrugsResult>(`/api/v1/pharmacies/${pharmacyId}/drugs/${keepId}/merge`, { mergeIds })
      .then((r) => r.data),

  /** Bulk add from the shared catalog with one optional price and optional opening stock. */
  fromCatalog: (pharmacyId: string, data: FromCatalogRequest) =>
    api.post<FromCatalogResult>(`/api/v1/pharmacies/${pharmacyId}/drugs/from-catalog`, data).then((r) => r.data),

  /** CSV of the list with the same filters (paging ignored). */
  exportCsv: (pharmacyId: string, type: "full" | "prices", params: DrugListParams) =>
    api
      .get<Blob>(`/api/v1/pharmacies/${pharmacyId}/drugs/export`, {
        // Paging is left out: the file holds every matching drug.
        params: { ...params, page: undefined, size: undefined, format: "csv", type },
        responseType: "blob",
      })
      .then((r) => r.data),

  getById: (pharmacyId: string, drugId: string) =>
    api.get<DrugResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs/${drugId}`).then((r) => normalizeDrug(r.data)),

  update: (pharmacyId: string, drugId: string, data: UpdateDrugRequest) =>
    api.put<DrugResponse>(`/api/v1/pharmacies/${pharmacyId}/drugs/${drugId}`, data).then((r) => normalizeDrug(r.data)),

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
