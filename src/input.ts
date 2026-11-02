import { readFileSync } from "node:fs";
import path from "node:path";

import { InputError } from "./errors.js";
import type { BendInput, PartInput } from "./types.js";

const NUMBER_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

export function parseNumber(raw: string, label: string): number {
  const text = raw.trim();
  if (!NUMBER_RE.test(text)) {
    throw new InputError(`${label} expects a number, got "${raw}"`);
  }
  const value = Number(text);
  if (!Number.isFinite(value)) {
    throw new InputError(`${label} expects a finite number, got "${raw}"`);
  }
  return value;
}

export function parseLegList(raw: string): number[] {
  const text = raw.trim();
  if (text === "") {
    throw new InputError("--legs expects a comma-separated list of lengths");
  }
  const parts = text.split(",");
  if (parts.some((part) => part.trim() === "")) {
    throw new InputError(`--legs contains an empty length ("${raw}")`);
  }
  return parts.map((part, index) => parseNumber(part, `leg ${index + 1}`));
}

/** `angle:radius` or `angle:radius:k`. */
export function parseBendToken(token: string): BendInput {
  const parts = token.split(":").map((part) => part.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => part === "")) {
    throw new InputError(`bend "${token}" must be angle:radius or angle:radius:k`);
  }
  const angle = parseNumber(parts[0] ?? "", "bend angle");
  const radius = parseNumber(parts[1] ?? "", "bend radius");
  const bend: BendInput = { angle, radius };
  if (parts.length === 3) {
    bend.kFactor = parseNumber(parts[2] ?? "", "bend K-factor");
  }
  return bend;
}

export interface CliOptions {
  help: boolean;
  version: boolean;
  json: boolean;
  thickness?: number;
  radius?: number;
  angle?: number;
  kFactor?: number;
  material?: string;
  legs?: number[];
  bends: BendInput[];
  specPath?: string;
  hasAngle: boolean;
  hasRadius: boolean;
}

const VALUE_FLAGS = new Set([
  "--t",
  "--thickness",
  "--r",
  "--radius",
  "--angle",
  "--k",
  "--k-factor",
  "--material",
  "--legs",
  "--bend",
  "--spec",
]);

function canonicalFlag(flag: string): string {
  switch (flag) {
    case "--t":
    case "--thickness":
      return "--t";
    case "--r":
    case "--radius":
      return "--r";
    case "--k":
    case "--k-factor":
      return "--k";
    default:
      return flag;
  }
}

function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith("--") || value.trim() === "") {
    throw new InputError(`missing value for ${flag}`);
  }
  return value;
}

function applyFlag(opts: CliOptions, flag: string, value: string): void {
  switch (flag) {
    case "--t":
      opts.thickness = parseNumber(value, "thickness T");
      return;
    case "--r":
      opts.hasRadius = true;
      opts.radius = parseNumber(value, "inside radius R");
      return;
    case "--angle":
      opts.hasAngle = true;
      opts.angle = parseNumber(value, "bend angle");
      return;
    case "--k":
      opts.kFactor = parseNumber(value, "K-factor");
      return;
    case "--material":
      opts.material = value.trim();
      if (opts.material === "") {
        throw new InputError("missing value for --material");
      }
      return;
    case "--legs":
      opts.legs = parseLegList(value);
      return;
    case "--bend":
      opts.bends.push(parseBendToken(value));
      return;
    case "--spec":
      opts.specPath = value.trim();
      return;
    default:
      throw new InputError(`unknown option "${flag}"`);
  }
}

export function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    help: false,
    version: false,
    json: false,
    bends: [],
    hasAngle: false,
    hasRadius: false,
  };
  const seen = new Set<string>();

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    let flag = arg;
    let inline: string | undefined;
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq !== -1) {
        flag = arg.slice(0, eq);
        inline = arg.slice(eq + 1);
      }
    }

    if (flag === "--help" || flag === "-h") {
      if (inline !== undefined) {
        throw new InputError(`${flag} does not take a value`);
      }
      opts.help = true;
      continue;
    }
    if (flag === "--version") {
      if (inline !== undefined) {
        throw new InputError("--version does not take a value");
      }
      opts.version = true;
      continue;
    }
    if (flag === "--json") {
      if (inline !== undefined) {
        throw new InputError("--json does not take a value");
      }
      opts.json = true;
      continue;
    }
    if (!flag.startsWith("--")) {
      throw new InputError(`unexpected argument "${arg}"`);
    }
    if (!VALUE_FLAGS.has(flag)) {
      throw new InputError(`unknown option "${flag}"`);
    }

    const value = inline !== undefined ? requireValue(flag, inline) : requireValue(flag, argv[++i]);
    const canonical = canonicalFlag(flag);
    if (canonical !== "--bend" && seen.has(canonical)) {
      throw new InputError(`duplicate option ${canonical}`);
    }
    if (canonical !== "--bend") {
      seen.add(canonical);
    }
    applyFlag(opts, canonical, value);
  }

  return opts;
}

export interface NormalizedSpec {
  thickness?: number;
  material?: string;
  kFactor?: number;
  legs?: number[];
  angle?: number;
  radius?: number;
  /** True when the file contains a bends array, even if that array is empty. */
  hasBends: boolean;
  bends: BendInput[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown, label: string): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed) && NUMBER_RE.test(value.trim())) {
      return parsed;
    }
  }
  throw new InputError(`${label} must be a finite number`);
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[],
  label: string,
): number | undefined {
  const present = keys.filter((key) => obj[key] !== undefined);
  if (present.length === 0) {
    return undefined;
  }
  const values = present.map((key) => asFiniteNumber(obj[key], `${label} (${key})`));
  const first = values[0] ?? Number.NaN;
  for (const value of values) {
    if (value !== first) {
      throw new InputError(
        `${label} is specified more than once with different values (${present.join(", ")})`,
      );
    }
  }
  return first;
}

function parseSpecLegs(value: unknown): number[] {
  if (typeof value === "string") {
    return parseLegList(value);
  }
  if (!Array.isArray(value)) {
    throw new InputError("spec legs must be an array of numbers or a comma-separated string");
  }
  if (value.length === 0) {
    throw new InputError("spec legs must list at least one length");
  }
  return value.map((leg, index) => asFiniteNumber(leg, `spec leg ${index + 1}`));
}

function parseSpecBend(value: unknown, index: number): BendInput {
  if (!isRecord(value)) {
    throw new InputError(`spec bend ${index + 1} must be an object`);
  }
  const angle = pickNumber(value, ["angle"], `spec bend ${index + 1} angle`);
  const radius = pickNumber(value, ["radius", "r"], `spec bend ${index + 1} radius`);
  const kFactor = pickNumber(value, ["kFactor", "k"], `spec bend ${index + 1} K-factor`);
  if (angle === undefined) {
    throw new InputError(`spec bend ${index + 1} is missing angle`);
  }
  if (radius === undefined) {
    throw new InputError(`spec bend ${index + 1} is missing radius`);
  }
  const bend: BendInput = { angle, radius };
  if (kFactor !== undefined) {
    bend.kFactor = kFactor;
  }
  return bend;
}

export function parseSpec(text: string, filename: string): NormalizedSpec {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new InputError(`spec file "${filename}" is not valid JSON`);
  }
  if (!isRecord(data)) {
    throw new InputError(`spec file "${filename}" must contain a JSON object`);
  }

  const thickness = pickNumber(data, ["thickness", "t"], "spec thickness");
  const kFactor = pickNumber(data, ["kFactor", "k"], "spec K-factor");
  const angle = pickNumber(data, ["angle"], "spec angle");
  const radius = pickNumber(data, ["radius", "r"], "spec radius");

  let material: string | undefined;
  if (data.material !== undefined) {
    if (typeof data.material !== "string" || data.material.trim() === "") {
      throw new InputError("spec material must be a non-empty string");
    }
    material = data.material.trim();
  }

  let legs: number[] | undefined;
  if (data.legs !== undefined) {
    legs = parseSpecLegs(data.legs);
  }

  const hasBends = data.bends !== undefined;
  let bends: BendInput[] = [];
  if (data.bends !== undefined) {
    if (!Array.isArray(data.bends)) {
      throw new InputError("spec bends must be an array");
    }
    if (angle !== undefined || radius !== undefined) {
      throw new InputError(
        "spec has both a bends array and a top-level angle or radius; use one form",
      );
    }
    bends = data.bends.map((bend, index) => parseSpecBend(bend, index));
  }

  const spec: NormalizedSpec = { hasBends, bends };
  if (thickness !== undefined) spec.thickness = thickness;
  if (material !== undefined) spec.material = material;
  if (kFactor !== undefined) spec.kFactor = kFactor;
  if (legs !== undefined) spec.legs = legs;
  if (angle !== undefined) spec.angle = angle;
  if (radius !== undefined) spec.radius = radius;
  return spec;
}

export function loadSpec(userPath: string, cwd: string): NormalizedSpec {
  const resolved = path.resolve(cwd, userPath);
  let text: string;
  try {
    text = readFileSync(resolved, "utf8");
  } catch (err) {
    const code =
      err !== null && typeof err === "object" && "code" in err ? String(err.code) : "";
    const suffix = code === "" ? "" : ` (${code})`;
    throw new InputError(`cannot read spec file "${userPath}"${suffix}`);
  }
  return parseSpec(text, userPath);
}

function bendsFromSpec(spec: NormalizedSpec): BendInput[] {
  if (spec.hasBends) {
    return spec.bends;
  }
  if (spec.angle === undefined && spec.radius === undefined) {
    return [];
  }
  if (spec.angle === undefined || spec.radius === undefined) {
    throw new InputError("spec single bend needs both angle and radius (or r)");
  }
  return [{ angle: spec.angle, radius: spec.radius }];
}

/** Merge CLI flags over an optional spec. CLI geometry replaces spec geometry. */
export function resolvePart(cli: CliOptions, spec?: NormalizedSpec): PartInput {
  if (cli.bends.length > 0 && (cli.hasAngle || cli.hasRadius)) {
    throw new InputError("use either repeated --bend or a single --angle with --r, not both");
  }
  if (cli.bends.length === 0 && cli.hasAngle !== cli.hasRadius) {
    throw new InputError("a single bend needs both --angle and --r (or use --bend angle:radius)");
  }

  const thickness = cli.thickness ?? spec?.thickness;
  const material = cli.material ?? spec?.material ?? "steel";
  const kFactor = cli.kFactor ?? spec?.kFactor;
  const legs = cli.legs ?? spec?.legs;

  let bends: BendInput[];
  if (cli.bends.length > 0) {
    bends = cli.bends;
  } else if (cli.hasAngle && cli.hasRadius && cli.angle !== undefined && cli.radius !== undefined) {
    bends = [{ angle: cli.angle, radius: cli.radius }];
  } else if (spec) {
    bends = bendsFromSpec(spec);
  } else {
    bends = [];
  }

  if (thickness === undefined) {
    throw new InputError("thickness T is required (--t, or thickness in the spec file)");
  }
  if (legs === undefined) {
    throw new InputError("outside leg lengths are required (--legs, or legs in the spec file)");
  }

  const part: PartInput = {
    thickness,
    material,
    legs,
    bends,
  };
  if (kFactor !== undefined) {
    part.kFactor = kFactor;
  }
  return part;
}
