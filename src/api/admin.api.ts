import api from "@/lib/api";
import type {
  Page,
  UserResponse,
  AdminUserStats,
  AdminSubscriptionStats,
  AuditFacets,
  AuditLogResponse,
  SystemStatus,
  AdminPlatformSettings,
  AdminOverview,
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
  SupportSession,
  MaintenanceRun,
  SupportRequest,
  Announcement,
  MaintenanceTask,
  BulkResult,
  BusinessReport,
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

  /** Changing an account needs a reason (kept in the audit log with the old and new values). */
  update: (userId: string, data: AdminUpdateUserRequest, reason: string) =>
    api.put<UserResponse>(`/api/v1/admin/users/${userId}`, { ...data, reason }).then((r) => r.data),

  /** Disabling needs a reason; enabling does not. */
  toggleEnabled: (userId: string, reason?: string) =>
    api
      .post<UserResponse>(`/api/v1/admin/users/${userId}/toggle-enabled`, { reason })
      .then((r) => r.data),

  resetPassword: (userId: string, newPassword: string, reason: string) =>
    api
      .post(`/api/v1/admin/users/${userId}/reset-password`, { newPassword, reason })
      .then((r) => r.data),

  deleteUser: (userId: string, reason: string) =>
    api.delete(`/api/v1/admin/users/${userId}`, { data: { reason } }).then((r) => r.data),

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

  /** Changes a plan's prices (whole TZS), its account / branch limits (null = unlimited) and/or whether it can be bought. */
  update: (
    planType: BillingPlan,
    data: { monthlyPrice?: number; weeklyPrice?: number | null; maxUsers?: number | null; maxBranches?: number | null; expensesEnabled?: boolean; active?: boolean; reason: string },
  ) =>
    api
      .put<AdminBillingPlan>(`/api/v1/admin/billing-plans/${planType}`, data)
      .then((r) => r.data),
};

// ─── Admin System Status API ──────────────────────────────────────────────────

export const adminOverviewApi = {
  /** Sales across every pharmacy, sign-ups per month, top pharmacies and the ones that need attention. */
  get: () => api.get<AdminOverview>("/api/v1/admin/overview").then((r) => r.data),
};

export const adminSystemApi = {
  /** Live measurements of the running platform (database, scheduler, backups, payments, ...). */
  status: () => api.get<SystemStatus>("/api/v1/admin/system").then((r) => r.data),
};

export interface BackupFile {
  name: string;
  sizeBytes: number;
  createdAt: string;
  onServer: boolean;
  offServer: boolean;
  status: string | null;
}

export interface BackupList {
  backups: BackupFile[];
  twoFactorEnabled: boolean;
  offServerConfigured: boolean;
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export const adminBackupApi = {
  list: (params?: { page?: number; size?: number }) => api.get<BackupList>("/api/v1/admin/backups", { params }).then((r) => r.data),

  /**
   * Re-checks the password and a fresh two-factor code on the server, then returns the file itself in the
   * response (no link is ever made). The checksum comes back so the copy can be verified after it is saved.
   */
  download: async (file: string, body: { password: string; code: string; reason: string }) => {
    try {
      const r = await api.post<Blob>(`/api/v1/admin/backups/${encodeURIComponent(file)}/download`, body, { responseType: "blob" });
      return { blob: r.data, sha256: (r.headers["x-checksum-sha256"] as string | undefined) ?? null };
    } catch (err) {
      // An error body arrives as a Blob here; turn it back into the usual JSON so the message can be shown.
      const res = (err as { response?: { data?: unknown } }).response;
      if (res?.data instanceof Blob) {
        try { res.data = JSON.parse(await res.data.text()); } catch { /* keep the blob */ }
      }
      throw err;
    }
  },
};

export const adminSettingsApi = {
  get: () => api.get<AdminPlatformSettings>("/api/v1/admin/settings").then((r) => r.data),
  setApprovalMode: (mode: AdminPlatformSettings["pharmacyApprovalMode"]) =>
    api.put<AdminPlatformSettings>("/api/v1/admin/settings", { pharmacyApprovalMode: mode }).then((r) => r.data),
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
  approve: (paymentId: string, data?: { amount?: number; reference?: string; reason?: string }) =>
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

  /** Confirms several waiting requests at their list price. Each one is checked and audited on its own. */
  bulkApprove: (ids: string[], reason?: string) =>
    api.post<BulkResult>("/api/v1/admin/payments/bulk-approve", { ids, reason }).then((r) => r.data),

  /** Downloads the (filtered) payment list as a CSV file. */
  exportCsv: async (params?: { method?: string; status?: string; from?: string; to?: string; search?: string }) => {
    const res = await api.get<Blob>("/api/v1/admin/payments/export", { params, responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

// ─── Admin: bulk actions on pharmacies ────────────────────────────────────────

export const adminBulkApi = {
  pharmacies: (action: "approve" | "reject" | "suspend" | "reactivate", ids: string[], reason?: string) =>
    api.post<BulkResult>("/api/v1/admin/pharmacies/bulk", { action, ids, reason }).then((r) => r.data),
};

// ─── Admin: support sessions (time-boxed, reasoned access to a pharmacy) ──────

export const adminSupportApi = {
  start: (pharmacyId: string, reason: string, minutes: number) =>
    api.post<SupportSession>("/api/v1/admin/support-sessions", { pharmacyId, reason, minutes }).then((r) => r.data),

  /** The running session for this pharmacy, or null. */
  active: (pharmacyId: string) =>
    api.get<SupportSession | null>("/api/v1/admin/support-sessions/active", { params: { pharmacyId } }).then((r) => (r.data && r.data.id ? r.data : null)),

  end: (sessionId: string) => api.post<SupportSession>(`/api/v1/admin/support-sessions/${sessionId}/end`).then((r) => r.data),

  list: (params?: { pharmacyId?: string; page?: number; size?: number }) =>
    api.get<Page<SupportSession>>("/api/v1/admin/support-sessions", { params }).then((r) => r.data),
};

// ─── Admin: business report ───────────────────────────────────────────────────

export const adminReportApi = {
  business: (params?: { from?: string; to?: string }) =>
    api.get<BusinessReport>("/api/v1/admin/reports/business", { params }).then((r) => r.data),
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

// ─── Admin: maintenance tasks (carried out by the background worker) ─────────

export const adminMaintenanceApi = {
  tasks: () => api.get<MaintenanceTask[]>("/api/v1/admin/maintenance/tasks").then((r) => r.data),

  runs: (params?: { page?: number; size?: number }) =>
    api.get<Page<MaintenanceRun>>("/api/v1/admin/maintenance/runs", { params }).then((r) => r.data),

  start: (data: { task: string; params: Record<string, string>; dryRun: boolean; reason: string }) =>
    api.post<MaintenanceRun>("/api/v1/admin/maintenance/runs", data).then((r) => r.data),

  cancel: (runId: string) => api.post<MaintenanceRun>(`/api/v1/admin/maintenance/runs/${runId}/cancel`).then((r) => r.data),
};

// ─── Admin: pharmacies' help requests and notices to pharmacies ─────────────

export const adminRequestApi = {
  list: (params?: { status?: string; page?: number; size?: number }) =>
    api.get<Page<SupportRequest> & { openCount: number }>("/api/v1/admin/support-requests", { params }).then((r) => r.data),

  resolve: (id: string, status: "Resolved" | "Rejected", note: string) =>
    api.post<SupportRequest>(`/api/v1/admin/support-requests/${id}/resolve`, { status, note }).then((r) => r.data),
};

export const adminAnnouncementApi = {
  list: (params?: { page?: number; size?: number }) =>
    api.get<Page<Announcement>>("/api/v1/admin/announcements", { params }).then((r) => r.data),

  create: (data: { title: string; message: string; level: "info" | "warning"; pharmacyIds?: string[]; startsAt?: string; endsAt?: string }) =>
    api.post<Announcement>("/api/v1/admin/announcements", data).then((r) => r.data),

  end: (id: string) => api.post<Announcement>(`/api/v1/admin/announcements/${id}/end`).then((r) => r.data),
};
