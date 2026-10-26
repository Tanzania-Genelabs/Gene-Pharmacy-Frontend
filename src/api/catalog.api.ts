import api from "@/lib/api";
import type { AddFromCatalogEntry, AddFromCatalogResult, CatalogFacets, CatalogItem, CatalogKind, Page } from "@/types";

const base = (pharmacyId: string) => `/api/v1/pharmacies/${pharmacyId}/catalog`;

/** The shared product catalog, as a pharmacy (owner or manager) uses it. */
export const catalogApi = {
  list: (pharmacyId: string, params?: { search?: string; kind?: CatalogKind; category?: string; page?: number; size?: number }) =>
    api.get<Page<CatalogItem>>(base(pharmacyId), { params }).then((r) => r.data),

  /** Kinds and categories that really exist in the catalog, with counts. */
  facets: (pharmacyId: string) => api.get<CatalogFacets>(`${base(pharmacyId)}/facets`).then((r) => r.data),

  /** Finds the catalog entry for a scanned barcode (404 when it isn't there). */
  byBarcode: (pharmacyId: string, barcode: string) =>
    api.get<CatalogItem>(`${base(pharmacyId)}/barcode/${encodeURIComponent(barcode)}`).then((r) => r.data),

  /** Copies catalog items into the pharmacy's own drug list, at the pharmacy's own prices. */
  add: (pharmacyId: string, items: AddFromCatalogEntry[]) =>
    api.post<AddFromCatalogResult>(`${base(pharmacyId)}/add`, { items }).then((r) => r.data),
};
