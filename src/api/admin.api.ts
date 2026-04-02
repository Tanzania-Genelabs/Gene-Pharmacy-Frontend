import api from "@/lib/api";
import type {
  Page,
  UserResponse,
  AdminUserStats,
  AdminSubscriptionStats,
  SubscriptionResponse,
  Role,
  AdminCreateUserRequest,
  AdminUpdateUserRequest,
} from "@/types";

// ─── Admin Audit Log Summary (matches backend DTO) ───────────────────────────
export interface AdminAuditLogSummary {
  id: string;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  createdAt: string;
}

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
    page?: number;
    size?: number;
  }) =>
    api
      .get<Page<AdminAuditLogSummary>>("/api/v1/admin/audit-logs", { params })
      .then((r) => r.data),
};

// ─── Admin Subscriptions API ──────────────────────────────────────────────────

export const adminSubscriptionApi = {
  list: (params?: {
    status?: string;
    planType?: string;
    pharmacyId?: string;
    page?: number;
    size?: number;
  }) =>
    api
      .get<Page<SubscriptionResponse>>("/api/v1/admin/subscriptions", {
        params,
      })
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
