import type { BendResult, PartResult } from "./types.js";

/** Shop-facing lengths. Four decimal places still round to the usual 0.01 unit. */
export function formatFixed(value: number, digits = 4): string {
  return value.toFixed(digits);
}

export function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function describeK(material: string, bend: BendResult): string {
  const k = formatFixed(bend.kFactor);
  if (bend.kFactorSource === "bend") {
    return `${k} (this bend)`;
  }
  if (bend.kFactorSource === "override") {
    return `${k} (user override)`;
  }
  return `${k} (table, ${material}, ${bend.tableBand ?? "R/T"})`;
}

/**
 * Text report. Formula lines match the definitions used by the calculator:
 * BA = (π/180)·A·(R + K·T), OSSB = tan(A/2)·(R+T), BD = 2·OSSB − BA,
 * flat length = sum of outside leg lengths − BD per bend.
 */
export function formatText(result: PartResult): string {
  const lines: string[] = [
    "Sheet-metal flat pattern",
    "",
    "BA = (π/180)·A·(R + K·T)",
    "OSSB = tan(A/2)·(R+T)",
    "BD = 2·OSSB − BA",
    "flat length = sum of outside leg lengths − BD per bend",
    "",
    `Thickness T: ${formatFixed(result.thickness)}`,
    `Material: ${result.material}`,
    `Outside legs: ${result.legs.map((leg) => formatFixed(leg)).join(", ")}`,
    "",
  ];

  result.bends.forEach((bend, index) => {
    lines.push(`Bend ${index + 1}`);
    lines.push(`  Angle A: ${formatFixed(bend.angle)} deg`);
    lines.push(`  Inside radius R: ${formatFixed(bend.radius)}`);
    lines.push(`  R/T: ${formatFixed(bend.radiusToThickness)}`);
    lines.push(`  K-factor: ${describeK(result.material, bend)}`);
    lines.push(`  Bend allowance BA: ${formatFixed(bend.bendAllowance)}`);
    lines.push(`  Outside setback OSSB: ${formatFixed(bend.outsideSetback)}`);
    lines.push(`  Bend deduction BD: ${formatFixed(bend.bendDeduction)}`);
    lines.push("");
  });

  lines.push(`Sum of outside legs: ${formatFixed(result.sumOfLegs)}`);
  lines.push(`Total bend deduction: ${formatFixed(result.totalBendDeduction)}`);
  lines.push(`Flat length: ${formatFixed(result.flatLength)}`);
  return `${lines.join("\n")}\n`;
}

function presentBend(bend: BendResult): Record<string, number | string> {
  const bendAllowance = roundTo(bend.bendAllowance, 6);
  const outsideSetback = roundTo(bend.outsideSetback, 6);
  // Recompute so the printed numbers still satisfy BD = 2·OSSB − BA.
  const bendDeduction = roundTo(2 * outsideSetback - bendAllowance, 6);
  const presented: Record<string, number | string> = {
    angle: roundTo(bend.angle, 6),
    radius: roundTo(bend.radius, 6),
    radiusToThickness: roundTo(bend.radiusToThickness, 6),
    kFactor: roundTo(bend.kFactor, 6),
    kFactorSource: bend.kFactorSource,
    bendAllowance,
    outsideSetback,
    bendDeduction,
  };
  if (bend.tableBand !== undefined) {
    presented.tableBand = bend.tableBand;
  }
  return presented;
}

/** JSON report. Lengths and factors are rounded to 6 decimal places. */
export function formatJson(result: PartResult): string {
  const bends = result.bends.map((bend) => presentBend(bend));
  const deductions = bends.map((bend) => bend.bendDeduction as number);
  const totalBendDeduction = roundTo(
    deductions.reduce((sum, deduction) => sum + deduction, 0),
    6,
  );
  const sumOfLegs = roundTo(
    result.legs.reduce((sum, leg) => sum + leg, 0),
    6,
  );
  const payload = {
    thickness: roundTo(result.thickness, 6),
    material: result.material,
    legs: result.legs.map((leg) => roundTo(leg, 6)),
    bends,
    sumOfLegs,
    totalBendDeduction,
    flatLength: roundTo(sumOfLegs - totalBendDeduction, 6),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}
