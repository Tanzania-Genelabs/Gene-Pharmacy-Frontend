import api from "@/lib/api";
import type {
  Page,
  StockResponse,
  LowStockResponse,
  StockMovementResponse,
  StockAdjustmentRequest,
  StockTransferRequest,
  StockTransferResponse,
} from "@/types";

export const inventoryApi = {
  list: (pharmacyId: string, params?: { page?: number; size?: number; branchId?: string }) =>
    api.get<Page<StockResponse>>(`/api/v1/pharmacies/${pharmacyId}/inventory`, { params }).then((r) => r.data),

  lowStock: (pharmacyId: string, params?: { branchId?: string }) =>
    api.get<Page<LowStockResponse>>(`/api/v1/pharmacies/${pharmacyId}/inventory/low-stock`, { params }).then((r) => r.data),

  getByDrugAndBranch: (pharmacyId: string, drugId: string, branchId: string) =>
    api
      .get<StockResponse>(`/api/v1/pharmacies/${pharmacyId}/inventory/drug/${drugId}/branch/${branchId}`)
      .then((r) => r.data),

  adjust: (pharmacyId: string, data: StockAdjustmentRequest) =>
    api
      .post<StockResponse>(`/api/v1/pharmacies/${pharmacyId}/inventory/adjust`, {
        drugId: data.drugId,
        branchId: data.branchId,
        movementType: data.movementType,
        quantity: data.adjustmentQuantity,
        notes: data.notes,
        expiryDate: data.expiryDate || undefined,
        batchNumber: data.batchNumber?.trim() || undefined,
      })
      .then((r) => r.data),

  transfer: (pharmacyId: string, data: StockTransferRequest) =>
    api.post<StockTransferResponse>(`/api/v1/pharmacies/${pharmacyId}/inventory/transfer`, data).then((r) => r.data),

  getMovements: (pharmacyId: string, params?: { page?: number; size?: number; drugId?: string; branchId?: string }) =>
    api
      .get<Page<StockMovementResponse>>(`/api/v1/pharmacies/${pharmacyId}/inventory/movements`, { params })
      .then((r) => r.data),

  getMovement: (pharmacyId: string, movementId: string) =>
    api
      .get<StockMovementResponse>(`/api/v1/pharmacies/${pharmacyId}/inventory/movements/${movementId}`)
      .then((r) => r.data),
};
