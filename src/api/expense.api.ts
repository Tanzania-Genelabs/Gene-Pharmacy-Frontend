import api from "@/lib/api";
import type {
  CreateExpenseRequest,
  ExpenseCategory,
  ExpenseResponse,
  ExpenseSummary,
  Page,
  UpdateExpenseRequest,
} from "@/types";

const base = (pharmacyId: string) => `/api/v1/pharmacies/${pharmacyId}/expenses`;

export interface ExpenseFilters {
  page?: number;
  size?: number;
  branchId?: string;
  categoryId?: string;
  status?: "Recorded" | "Voided";
  search?: string;
  from?: string;
  to?: string;
}

export const expenseApi = {
  /** Which features the pharmacy's plan includes (open to every role). */
  features: (pharmacyId: string) =>
    api.get<{ expenses: boolean }>(`/api/v1/pharmacies/${pharmacyId}/features`).then((r) => r.data),

  categories: (pharmacyId: string, includeInactive = false) =>
    api.get<ExpenseCategory[]>(`${base(pharmacyId)}/categories`, { params: { includeInactive } }).then((r) => r.data),

  createCategory: (pharmacyId: string, name: string) =>
    api.post<ExpenseCategory>(`${base(pharmacyId)}/categories`, { name }).then((r) => r.data),

  updateCategory: (pharmacyId: string, id: string, data: { name?: string; active?: boolean }) =>
    api.put<ExpenseCategory>(`${base(pharmacyId)}/categories/${id}`, data).then((r) => r.data),

  list: (pharmacyId: string, params?: ExpenseFilters) =>
    api.get<Page<ExpenseResponse>>(base(pharmacyId), { params }).then((r) => r.data),

  create: (pharmacyId: string, data: CreateExpenseRequest) =>
    api.post<ExpenseResponse>(base(pharmacyId), data).then((r) => r.data),

  update: (pharmacyId: string, id: string, data: UpdateExpenseRequest) =>
    api.put<ExpenseResponse>(`${base(pharmacyId)}/${id}`, data).then((r) => r.data),

  void: (pharmacyId: string, id: string, reason: string) =>
    api.post<ExpenseResponse>(`${base(pharmacyId)}/${id}/void`, { reason }).then((r) => r.data),

  summary: (pharmacyId: string, params: { from: string; to: string; branchId?: string }) =>
    api.get<ExpenseSummary>(`${base(pharmacyId)}/summary`, { params }).then((r) => r.data),

  export: (pharmacyId: string, format: "csv" | "excel" | "pdf", params: { from: string; to: string; branchId?: string }) =>
    api
      .get<Blob>(`${base(pharmacyId)}/export`, {
        params: { ...params, format: format === "excel" ? "xlsx" : format },
        responseType: "blob",
      })
      .then((r) => r.data),
};
