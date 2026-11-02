import { InputError } from "./errors.js";
import type { Material } from "./types.js";

/**
 * Built-in air-bend K-factors by material and inside-radius / thickness (R/T).
 *
 * Source: the air-bending rows of the K-factor chart commonly reproduced from
 * Machinery's Handbook practice and published in sheet-metal shop references
 * (soft / medium / hard columns). The same figures are listed by American Steel
 * & Aluminum, "Sheet Metal Bend Allowance and K-Factor"
 * (https://americansteelandaluminum.com/resources/fabrication/sheet-metal-bend-allowance-k-factor/)
 * and by calculators that attribute the chart to Machinery's Handbook, including
 * the summary at https://calcformula.com/k-factor-calculator/ (sheetmetal.me chart):
 *
 *   R/T <= 1      "0 to T"     aluminium 0.33, steel 0.38, stainless 0.40
 *   1 < R/T <= 3  "T to 3T"    aluminium 0.40, steel 0.43, stainless 0.45
 *   R/T > 3       "over 3T"    0.50 for all three
 *
 * Material columns follow that chart: soft → aluminium, medium → steel,
 * hard → stainless. The lower edge of each band is inclusive: R = T uses the
 * first band, and R = 3T uses the second. A sharp bend (R = 0) uses the first.
 *
 * These are starting values for air bending, not a measured process. Bottoming
 * and coining usually need a higher K. Pass a test-coupon result with --k.
 */
export const K_FACTOR_TABLE: Readonly<Record<Material, readonly { maxRatio: number; kFactor: number }[]>> = {
  aluminium: [
    { maxRatio: 1, kFactor: 0.33 },
    { maxRatio: 3, kFactor: 0.4 },
    { maxRatio: Number.POSITIVE_INFINITY, kFactor: 0.5 },
  ],
  steel: [
    { maxRatio: 1, kFactor: 0.38 },
    { maxRatio: 3, kFactor: 0.43 },
    { maxRatio: Number.POSITIVE_INFINITY, kFactor: 0.5 },
  ],
  stainless: [
    { maxRatio: 1, kFactor: 0.4 },
    { maxRatio: 3, kFactor: 0.45 },
    { maxRatio: Number.POSITIVE_INFINITY, kFactor: 0.5 },
  ],
};

export interface KFactorLookup {
  kFactor: number;
  radiusToThickness: number;
  /** Human-readable R/T band, for example "R/T <= 1". */
  band: string;
}

export function kFactorBand(maxRatio: number): string {
  if (maxRatio <= 1) {
    return "R/T <= 1";
  }
  if (maxRatio <= 3) {
    return "1 < R/T <= 3";
  }
  return "R/T > 3";
}

/**
 * Look up the default air-bend K-factor. Thickness must already be > 0.
 * Radius must already be >= 0.
 */
export function lookupKFactor(material: Material, radius: number, thickness: number): KFactorLookup {
  const bands = K_FACTOR_TABLE[material];
  const ratio = radius / thickness;
  for (const band of bands) {
    if (ratio <= band.maxRatio) {
      return {
        kFactor: band.kFactor,
        radiusToThickness: ratio,
        band: kFactorBand(band.maxRatio),
      };
    }
  }
  // The last band is unbounded, so this is only reached if the table is empty.
  throw new InputError(`no K-factor band for ${material} at R/T = ${ratio}`);
}

/** Accept common spellings and return the canonical material name. */
export function normalizeMaterial(raw: string): Material {
  const key = raw.trim().toLowerCase().replace(/[\s_]+/g, "-");
  switch (key) {
    case "steel":
      return "steel";
    case "aluminium":
    case "aluminum":
      return "aluminium";
    case "stainless":
    case "stainless-steel":
      return "stainless";
    default:
      throw new InputError(
        `unknown material "${raw}". Expected steel, aluminium (aluminum), or stainless.`,
      );
  }
}
