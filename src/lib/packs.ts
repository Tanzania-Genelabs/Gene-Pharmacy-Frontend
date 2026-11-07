/**
 * Stock, prices and sale quantities are all counted in the drug's smallest unit (e.g. a tablet).
 * A pack is `unitsPerPack` of those units, so these helpers only translate for display and entry.
 */
export interface PackInfo {
  unit: string;
  unitsPerPack: number;
  packUnit: string | null;
  /** The drug is sold by the half dose, so its stock can also be counted in halves (5.5 blisters). */
  halfUnit?: boolean;
}

export function packInfo(
  drug?: { unit?: string | null; unitsPerPack?: number | null; packUnit?: string | null; allowsHalfDose?: boolean | null } | null,
): PackInfo {
  return {
    unit: drug?.unit || "unit",
    unitsPerPack: drug?.unitsPerPack && drug.unitsPerPack > 1 ? drug.unitsPerPack : 1,
    packUnit: drug?.packUnit || null,
    halfUnit: Boolean(drug?.allowsHalfDose),
  };
}

export function hasPacks(info: PackInfo): boolean {
  return info.unitsPerPack > 1;
}

/** A pack can be halved only when half of it is a whole number of units (a strip of 10 yes, of 15 no). */
export function canSplitPack(info: PackInfo): boolean {
  return info.unitsPerPack > 1 && info.unitsPerPack % 2 === 0;
}

export function packLabel(info: PackInfo): string {
  return info.packUnit || "pack";
}

/** 130 tablets of a 100-tablet box -> "1 box + 30 tablet"; under one pack -> "30 tablet". */
export function formatQuantity(quantity: number, info: PackInfo): string {
  if (!hasPacks(info)) {
    return `${quantity} ${info.unit}`;
  }
  const sign = quantity < 0 ? "-" : "";
  const abs = Math.abs(quantity);
  const packs = Math.floor(abs / info.unitsPerPack);
  const loose = abs % info.unitsPerPack;
  if (packs === 0) return `${sign}${loose} ${info.unit}`;
  if (loose === 0) return `${sign}${packs} ${packLabel(info)}`;
  return `${sign}${packs} ${packLabel(info)} + ${loose} ${info.unit}`;
}
