import api from "@/lib/api";
import type { OwnerDashboardResponse } from "@/types";

/** The Owner/Manager home screen. Cached on the server (~45 s), so polling every minute is cheap. Sellers get 403. */
export const dashboardApi = {
  owner: (pharmacyId: string, params?: { branchId?: string; tz?: string }) =>
    api
      .get<OwnerDashboardResponse>(`/api/v1/pharmacies/${pharmacyId}/dashboard/owner`, { params })
      .then((r) => r.data),
};
