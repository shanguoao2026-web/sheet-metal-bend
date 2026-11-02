import { InputError } from "./errors.js";
import { bendAllowance, bendDeduction, flatLength, outsideSetback } from "./formulas.js";
import { lookupKFactor, normalizeMaterial } from "./kfactor.js";
import type { BendInput, BendResult, Material, PartInput, PartResult } from "./types.js";

function finiteInRange(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateKFactor(value: number | undefined, label: string): void {
  if (value === undefined) {
    return;
  }
  if (!finiteInRange(value) || value <= 0 || value > 1) {
    throw new InputError(`${label} must be greater than 0 and at most 1 (got ${String(value)})`);
  }
}

function validateBends(bends: BendInput[]): void {
  if (!Array.isArray(bends) || bends.length === 0) {
    throw new InputError(
      "at least one bend is required (--angle with --r, repeated --bend, or bends in the spec)",
    );
  }
  bends.forEach((bend, index) => {
    const where = `bend ${index + 1}`;
    if (!finiteInRange(bend.angle) || bend.angle <= 0 || bend.angle >= 180) {
      throw new InputError(
        `${where} angle must be greater than 0 and less than 180 degrees (got ${String(bend.angle)})`,
      );
    }
    if (!finiteInRange(bend.radius) || bend.radius < 0) {
      throw new InputError(
        `${where} inside radius R must be greater than or equal to 0 (got ${String(bend.radius)})`,
      );
    }
    validateKFactor(bend.kFactor, `${where} K-factor`);
  });
}

function validateLegs(legs: number[], bendCount: number): void {
  if (!Array.isArray(legs) || legs.length === 0) {
    throw new InputError("outside leg lengths are required (--legs, or legs in the spec file)");
  }
  const expected = bendCount + 1;
  if (legs.length !== expected) {
    const bendWord = bendCount === 1 ? "bend" : "bends";
    throw new InputError(
      `expected ${expected} outside leg lengths for ${bendCount} ${bendWord}, got ${legs.length}. ` +
        "Outside legs are measured to the mold line, one more leg than the number of bends.",
    );
  }
  legs.forEach((leg, index) => {
    if (!finiteInRange(leg) || leg <= 0) {
      throw new InputError(`leg ${index + 1} must be a finite number greater than 0 (got ${String(leg)})`);
    }
  });
}

function evaluateBend(input: PartInput, material: Material, bend: BendInput): BendResult {
  const ratio = bend.radius / input.thickness;
  let kFactor: number;
  let kFactorSource: BendResult["kFactorSource"];
  let tableBand: string | undefined;

  if (bend.kFactor !== undefined) {
    kFactor = bend.kFactor;
    kFactorSource = "bend";
  } else if (input.kFactor !== undefined) {
    kFactor = input.kFactor;
    kFactorSource = "override";
  } else {
    const lookedUp = lookupKFactor(material, bend.radius, input.thickness);
    kFactor = lookedUp.kFactor;
    kFactorSource = "table";
    tableBand = lookedUp.band;
  }

  const allowance = bendAllowance(bend.angle, bend.radius, kFactor, input.thickness);
  const setback = outsideSetback(bend.angle, bend.radius, input.thickness);
  const result: BendResult = {
    angle: bend.angle,
    radius: bend.radius,
    radiusToThickness: ratio,
    kFactor,
    kFactorSource,
    bendAllowance: allowance,
    outsideSetback: setback,
    bendDeduction: bendDeduction(setback, allowance),
  };
  if (tableBand !== undefined) {
    result.tableBand = tableBand;
  }
  return result;
}

/**
 * Validate a part and compute bend allowance, outside setback, bend deduction,
 * and the flat length. Throws {@link InputError} for illegal geometry.
 */
export function calculateFlatPattern(input: PartInput): PartResult {
  if (!finiteInRange(input.thickness) || input.thickness <= 0) {
    throw new InputError(
      `thickness T must be a finite number greater than 0 (got ${String(input.thickness)})`,
    );
  }
  validateKFactor(input.kFactor, "K-factor");
  const material = normalizeMaterial(String(input.material ?? ""));
  validateBends(input.bends);
  validateLegs(input.legs, input.bends.length);

  const bends = input.bends.map((bend) => evaluateBend(input, material, bend));
  const deductions = bends.map((bend) => bend.bendDeduction);
  const length = flatLength(input.legs, deductions);
  const sumOfLegs = input.legs.reduce((sum, leg) => sum + leg, 0);

  return {
    thickness: input.thickness,
    material,
    legs: [...input.legs],
    bends,
    sumOfLegs,
    totalBendDeduction: deductions.reduce((sum, deduction) => sum + deduction, 0),
    flatLength: length,
  };
}
