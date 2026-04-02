import api from "@/lib/api";
import type { BarcodeLookupResponse, RepeatPrescriptionResponse } from "@/types";

export const posApi = {
  lookupBarcode: (pharmacyId: string, barcode: string, branchId: string) =>
    api.get<BarcodeLookupResponse>(`/api/v1/pharmacies/${pharmacyId}/pos/barcode/${barcode}`, { params: { branchId } }).then((r) => r.data),

  repeatPrescription: (pharmacyId: string, customerId: string, branchId: string) =>
    api.get<RepeatPrescriptionResponse>(`/api/v1/pharmacies/${pharmacyId}/pos/repeat-prescription/${customerId}`, { params: { branchId } }).then((r) => r.data),
};
