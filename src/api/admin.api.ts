import api from "@/lib/api";
import type {
  Page,
  UserResponse,
  AdminUserStats,
  AdminSubscriptionStats,
  AuditFacets,
  AuditLogResponse,
  SystemStatus,
  AdminBillingPlan,
  CatalogFacets,
  CatalogImportResult,
  CatalogItem,
  CatalogItemInput,
  CatalogKind,
  CatalogStats,
  AdminPaymentResponse,
  AdminPaymentSummary,
  AdminSubscriptionRow,
  GrantAccessRequest,
  BillingPlan,
  SubscriptionResponse,
  Role,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
} from "@/types";

// ─── Admin Users API ──────────────────────────────────────────────────────────

export const adminUserApi = {
  list: (params?: {
    role?: Role;
    pharmacyId?: string;
    enabled?: boolean;
    search?: string;
    page?: number;
    size?: number;
  }) =>
    api
      .get<Page<UserResponse>>("/api/v1/admin/users", { params })
      .then((r) => r.data),

  getById: (userId: string) =>
    api.get<UserResponse>(`/api/v1/admin/users/${userId}`).then((r) => r.data),

  create: (data: AdminCreateUserRequest) =>
    api.post<UserResponse>("/api/v1/admin/users", data).then((r) => r.data),

  update: (userId: string, data: AdminUpdateUserRequest) =>
    api.put<UserResponse>(`/api/v1/admin/users/${userId}`, data).then((r) => r.data),

  toggleEnabled: (userId: string) =>
    api
      .post<UserResponse>(`/api/v1/admin/users/${userId}/toggle-enabled`)
      .then((r) => r.data),

  resetPassword: (userId: string, newPassword: string) =>
    api
      .post(`/api/v1/admin/users/${userId}/reset-password`, { newPassword })
      .then((r) => r.data),

  deleteUser: (userId: string) =>
    api.delete(`/api/v1/admin/users/${userId}`).then((r) => r.data),

  stats: () =>
    api.get<AdminUserStats>("/api/v1/admin/users/stats").then((r) => r.data),
};

// ─── Admin Audit Logs API ─────────────────────────────────────────────────────

export const adminAuditLogApi = {
  list: (params?: {
    pharmacyId?: string;
    action?: string;
    entityType?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    size?: number;
  }) =>
    api.get<Page<AuditLogResponse>>("/api/v1/admin/audit-logs", { params }).then((r) => r.data),

  /** The actions and entity types that really exist in the platform log. */
  facets: () => api.get<AuditFacets>("/api/v1/admin/audit-logs/facets").then((r) => r.data),
};

// ─── Admin Subscriptions API ──────────────────────────────────────────────────

export const adminSubscriptionApi = {
  list: (params?: {
    status?: string;
    planType?: string;
    pharmacyId?: string;
    search?: string;
    page?: number;
    size?: number;
  }) =>
    api
      .get<Page<AdminSubscriptionRow>>("/api/v1/admin/subscriptions", { params })
      .then((r) => r.data),

  /**
   * Gives a pharmacy access without ClickPesa: cash that was received, or a free promotion. Extends
   * its subscription and records the entry in the payment ledger.
   */
  grant: (data: GrantAccessRequest) =>
    api
      .post<{ payment: AdminPaymentResponse; subscription: AdminSubscriptionRow }>("/api/v1/admin/subscriptions/grant", data)
      .then((r) => r.data),

  getById: (subscriptionId: string) =>
    api
      .get<SubscriptionResponse>(
        `/api/v1/admin/subscriptions/${subscriptionId}`
      )
      .then((r) => r.data),

  stats: () =>
    api
      .get<AdminSubscriptionStats>("/api/v1/admin/subscriptions/stats")
      .then((r) => r.data),
};

// ─── Admin Billing Plans API ──────────────────────────────────────────────────

export const adminBillingPlanApi = {
  list: () =>
    api.get<AdminBillingPlan[]>("/api/v1/admin/billing-plans").then((r) => r.data),

  /** Changes a plan's monthly price (whole TZS) and/or whether it can be bought. */
  update: (planType: BillingPlan, data: { monthlyPrice?: number; weeklyPrice?: number | null; active?: boolean }) =>
    api
      .put<AdminBillingPlan>(`/api/v1/admin/billing-plans/${planType}`, data)
      .then((r) => r.data),
};

// ─── Admin System Status API ──────────────────────────────────────────────────

export const adminSystemApi = {
  /** Live measurements of the running platform (database, scheduler, backups, payments, ...). */
  status: () => api.get<SystemStatus>("/api/v1/admin/system").then((r) => r.data),
};

// ─── Admin Payments (ledger of what pharmacies paid) ──────────────────────────

export const adminPaymentApi = {
  list: (params?: {
    pharmacyId?: string;
    method?: string;
    status?: string;
    from?: string;
    to?: string;
    search?: string;
    page?: number;
    size?: number;
  }) =>
    api.get<Page<AdminPaymentResponse>>("/api/v1/admin/payments", { params }).then((r) => r.data),

  summary: (params: { from: string; to: string }) =>
    api.get<AdminPaymentSummary>("/api/v1/admin/payments/summary", { params }).then((r) => r.data),

  /** Confirms a plan request: the money arrived, so the pharmacy gets its period. The amount defaults to the list price. */
  approve: (paymentId: string, data?: { amount?: number; reference?: string }) =>
    api
      .post<{ payment: AdminPaymentResponse; subscription: AdminSubscriptionRow }>(`/api/v1/admin/payments/${paymentId}/approve`, data ?? {})
      .then((r) => r.data),

  /** Declines a plan request; the reason is shown to the owner. */
  reject: (paymentId: string, reason: string) =>
    api.post<AdminPaymentResponse>(`/api/v1/admin/payments/${paymentId}/reject`, { reason }).then((r) => r.data),

  /** Undoes a mistaken cash/promotion entry (takes its weeks/months back). Mobile-money payments cannot be voided here. */
  void: (paymentId: string, reason: string) =>
    api
      .post<{ payment: AdminPaymentResponse; subscription: AdminSubscriptionRow | null }>(`/api/v1/admin/payments/${paymentId}/void`, { reason })
      .then((r) => r.data),
};

// ─── Admin: shared product catalog ────────────────────────────────────────────

export const adminCatalogApi = {
  list: (params?: {
    search?: string;
    kind?: CatalogKind;
    category?: string;
    source?: string;
    verified?: boolean;
    active?: boolean;
    page?: number;
    size?: number;
  }) =>
    api
      .get<Page<CatalogItem>>("/api/v1/admin/catalog", {
        // Laravel's boolean rule wants 1/0, not true/false.
        params: { ...params, verified: params?.verified === undefined ? undefined : Number(params.verified), active: params?.active === undefined ? undefined : Number(params.active) },
      })
      .then((r) => r.data),

  facets: () => api.get<CatalogFacets>("/api/v1/admin/catalog/facets").then((r) => r.data),
  stats: () => api.get<CatalogStats>("/api/v1/admin/catalog/stats").then((r) => r.data),

  create: (data: CatalogItemInput) => api.post<CatalogItem>("/api/v1/admin/catalog", data).then((r) => r.data),
  update: (id: string, data: Partial<CatalogItemInput>) =>
    api.put<CatalogItem>(`/api/v1/admin/catalog/${id}`, data).then((r) => r.data),
  /** Hides it from pharmacies; pharmacies that already added it keep their copy. */
  deactivate: (id: string) => api.delete<CatalogItem>(`/api/v1/admin/catalog/${id}`).then((r) => r.data),
  reactivate: (id: string) => api.post<CatalogItem>(`/api/v1/admin/catalog/${id}/reactivate`).then((r) => r.data),

  /** Loads an Excel/CSV file. With dryRun the file is only checked: nothing is saved. */
  import: (file: File, options: { dryRun: boolean; source?: string; kind?: CatalogKind; verified?: boolean }) => {
    const form = new FormData();
    form.append("file", file);
    form.append("dryRun", options.dryRun ? "1" : "0");
    if (options.source) form.append("source", options.source);
    if (options.kind) form.append("kind", options.kind);
    form.append("verified", options.verified ? "1" : "0");

    return api
      .post<CatalogImportResult>("/api/v1/admin/catalog/import", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
};
