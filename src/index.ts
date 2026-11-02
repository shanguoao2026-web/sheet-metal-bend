export { calculateFlatPattern } from "./calculate.js";
export { InputError } from "./errors.js";
export { bendAllowance, bendDeduction, flatLength, outsideSetback } from "./formulas.js";
export { formatJson, formatText } from "./format.js";
export { K_FACTOR_TABLE, lookupKFactor, normalizeMaterial } from "./kfactor.js";
export type {
  BendInput,
  BendResult,
  KFactorSource,
  Material,
  PartInput,
  PartResult,
} from "./types.js";
