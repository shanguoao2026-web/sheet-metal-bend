/** Canonical material names. "aluminum" is accepted and stored as "aluminium". */
export type Material = "steel" | "aluminium" | "stainless";

/** Where the K-factor used for a bend came from. */
export type KFactorSource = "bend" | "override" | "table";

/** One bend. Set `kFactor` only to override the global K and the built-in table. */
export interface BendInput {
  /** Bend angle in degrees. The sheet turns through this angle. 0 < angle < 180. */
  angle: number;
  /** Inside bend radius. Same linear unit as thickness and legs. R >= 0. */
  radius: number;
  /** Per-bend K-factor. Wins over a global override and the material table. */
  kFactor?: number;
}

export interface PartInput {
  /** Sheet thickness T > 0. */
  thickness: number;
  material: Material | string;
  /**
   * Global K-factor override. Used for bends that do not set their own K.
   * When omitted, K comes from the built-in material table.
   */
  kFactor?: number;
  /**
   * Outside leg lengths measured to the mold line (virtual sharp).
   * There is one more leg than there are bends.
   */
  legs: number[];
  bends: BendInput[];
}

export interface BendResult {
  angle: number;
  radius: number;
  radiusToThickness: number;
  kFactor: number;
  kFactorSource: KFactorSource;
  /** Set when `kFactorSource` is "table". */
  tableBand?: string;
  bendAllowance: number;
  outsideSetback: number;
  bendDeduction: number;
}

export interface PartResult {
  thickness: number;
  material: Material;
  legs: number[];
  bends: BendResult[];
  sumOfLegs: number;
  totalBendDeduction: number;
  flatLength: number;
}
