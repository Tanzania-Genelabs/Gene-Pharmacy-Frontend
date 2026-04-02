import api from "@/lib/api";
import type { Page, NotificationResponse, NotificationSummaryResponse } from "@/types";

export const notificationApi = {
  list: (pharmacyId: string, params?: { page?: number; size?: number; status?: string }) =>
    api
      .get<Page<NotificationResponse>>(`/api/v1/pharmacies/${pharmacyId}/notifications`, { params })
      .then((r) => r.data),

  getById: (pharmacyId: string, notificationId: string) =>
    api
      .get<NotificationResponse>(`/api/v1/pharmacies/${pharmacyId}/notifications/${notificationId}`)
      .then((r) => r.data),

  markRead: (pharmacyId: string, notificationId: string) =>
    api
      .post<NotificationResponse>(`/api/v1/pharmacies/${pharmacyId}/notifications/${notificationId}/read`)
      .then((r) => r.data),

  markAllRead: (pharmacyId: string) =>
    api.post(`/api/v1/pharmacies/${pharmacyId}/notifications/read-all`).then((r) => r.data),

  pendingCount: (pharmacyId: string) =>
    api
      .get<NotificationSummaryResponse>(`/api/v1/pharmacies/${pharmacyId}/notifications/summary`)
      .then((r) => r.data),
};
