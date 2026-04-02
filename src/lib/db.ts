import Dexie, { type Table } from "dexie";

/** ──────────────────────────────────────────────
 *  Offline POS sale queue — stored in IndexedDB
 *  Synced to the backend when connectivity is
 *  restored. Cleared on successful push.
 * ──────────────────────────────────────────────*/

export interface OfflineSaleItem {
  drugId: string;
  drugName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface OfflineSale {
  id?: number; // auto-increment
  localId: string; // UUID for deduplication
  pharmacyId: string;
  branchId: string;
  shiftId: string;
  items: OfflineSaleItem[];
  totalAmount: number;
  paymentMethod: string;
  patientName?: string;
  createdAt: string; // ISO string
  synced: boolean;
  syncError?: string;
}

export interface OfflineDrug {
  id: string; // backend UUID
  pharmacyId: string;
  branchId: string;
  name: string;
  genericName: string;
  barcode?: string;
  sellingPrice: number;
  stockLevel: number;
  cachedAt: string; // ISO string
}

class PharmacyDB extends Dexie {
  offlineSales!: Table<OfflineSale, number>;
  drugCache!: Table<OfflineDrug, string>;

  constructor() {
    super("GenePharmacyDB");

    this.version(1).stores({
      offlineSales: "++id, localId, pharmacyId, branchId, synced, createdAt",
      drugCache: "id, pharmacyId, branchId, barcode, name",
    });
  }
}

export const db = new PharmacyDB();

// ─── Helpers ──────────────────────────────────

export async function queueOfflineSale(sale: Omit<OfflineSale, "id">): Promise<number> {
  return db.offlineSales.add(sale);
}

export async function getPendingOfflineSales(pharmacyId: string): Promise<OfflineSale[]> {
  return db.offlineSales.where({ pharmacyId, synced: 0 as unknown as boolean }).toArray();
}

export async function markOfflineSaleSynced(id: number): Promise<void> {
  await db.offlineSales.update(id, { synced: true });
}

export async function markOfflineSaleFailed(id: number, error: string): Promise<void> {
  await db.offlineSales.update(id, { syncError: error });
}

export async function cacheDrugs(drugs: OfflineDrug[]): Promise<void> {
  await db.drugCache.bulkPut(drugs);
}

export async function getCachedDrugs(pharmacyId: string, branchId: string): Promise<OfflineDrug[]> {
  return db.drugCache.where({ pharmacyId, branchId }).toArray();
}

export async function searchCachedDrugs(pharmacyId: string, branchId: string, query: string): Promise<OfflineDrug[]> {
  const q = query.toLowerCase();
  return db.drugCache
    .where({ pharmacyId, branchId })
    .filter((d) => d.name.toLowerCase().includes(q) || (d.barcode ?? "").includes(q))
    .toArray();
}
