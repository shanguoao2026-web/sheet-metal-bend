/**
 * Sheet-metal flat-pattern formulas used by press-brake shops and CAD.
 *
 *   BA   = (π/180) · A · (R + K · T)
 *   OSSB = tan(A/2) · (R + T)
 *   BD   = 2 · OSSB − BA
 *   Flat = Σ outside leg lengths − Σ BD
 *
 * A is the bend angle in degrees: how far the sheet is turned, so 90 is a
 * right-angle bend. Legs are outside dimensions to the mold line (virtual
 * sharp), not to the tangent point. K is the neutral-axis position measured
 * from the inside face, as a fraction of thickness.
 */

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Bend allowance: arc length of the neutral axis through the bend. */
export function bendAllowance(
  angleDeg: number,
  radius: number,
  kFactor: number,
  thickness: number,
): number {
  return toRadians(angleDeg) * (radius + kFactor * thickness);
}

/** Outside setback: mold-line apex to the start of the bend, along one leg. */
export function outsideSetback(angleDeg: number, radius: number, thickness: number): number {
  return Math.tan(toRadians(angleDeg / 2)) * (radius + thickness);
}

/** Bend deduction: how much to subtract from the sum of outside legs. */
export function bendDeduction(ossb: number, allowance: number): number {
  return 2 * ossb - allowance;
}

/**
 * Flat length from outside leg lengths and one bend deduction per bend.
 * Equivalent, for a single bend, to (L1 − OSSB) + BA + (L2 − OSSB).
 */
export function flatLength(legs: readonly number[], deductions: readonly number[]): number {
  let legSum = 0;
  for (const leg of legs) {
    legSum += leg;
  }
  let deductionSum = 0;
  for (const deduction of deductions) {
    deductionSum += deduction;
  }
  return legSum - deductionSum;
}
