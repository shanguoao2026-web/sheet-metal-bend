import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InputError } from "../src/errors.js";
import { K_FACTOR_TABLE, lookupKFactor, normalizeMaterial } from "../src/kfactor.js";
import type { Material } from "../src/types.js";

const MATERIALS: Material[] = ["aluminium", "steel", "stainless"];

describe("K-factor table", () => {
  it("stores the air-bend chart", () => {
    assert.deepEqual(
      K_FACTOR_TABLE.aluminium.map((band) => band.kFactor),
      [0.33, 0.4, 0.5],
    );
    assert.deepEqual(
      K_FACTOR_TABLE.steel.map((band) => band.kFactor),
      [0.38, 0.43, 0.5],
    );
    assert.deepEqual(
      K_FACTOR_TABLE.stainless.map((band) => band.kFactor),
      [0.4, 0.45, 0.5],
    );
  });

  it("uses inclusive edges at R/T = 1 and R/T = 3", () => {
    const cases: Array<{ radius: number; thickness: number; band: string }> = [
      { radius: 0, thickness: 2, band: "R/T <= 1" },
      { radius: 1, thickness: 2, band: "R/T <= 1" },
      { radius: 2, thickness: 2, band: "R/T <= 1" },
      { radius: 2.2, thickness: 2, band: "1 < R/T <= 3" },
      { radius: 4, thickness: 2, band: "1 < R/T <= 3" },
      { radius: 6, thickness: 2, band: "1 < R/T <= 3" },
      { radius: 6.2, thickness: 2, band: "R/T > 3" },
      { radius: 20, thickness: 2, band: "R/T > 3" },
    ];
    for (const material of MATERIALS) {
      for (const sample of cases) {
        const lookedUp = lookupKFactor(material, sample.radius, sample.thickness);
        const ratio = sample.radius / sample.thickness;
        assert.equal(lookedUp.band, sample.band, `${material} at R/T ${ratio}`);
        const expected = K_FACTOR_TABLE[material].find((band) => ratio <= band.maxRatio);
        assert.equal(lookedUp.kFactor, expected?.kFactor);
        assert.equal(lookedUp.radiusToThickness, ratio);
      }
    }
  });
});

describe("material names", () => {
  it("accepts the documented aliases", () => {
    assert.equal(normalizeMaterial("steel"), "steel");
    assert.equal(normalizeMaterial(" Steel "), "steel");
    assert.equal(normalizeMaterial("aluminium"), "aluminium");
    assert.equal(normalizeMaterial("Aluminum"), "aluminium");
    assert.equal(normalizeMaterial("stainless"), "stainless");
    assert.equal(normalizeMaterial("Stainless Steel"), "stainless");
    assert.equal(normalizeMaterial("stainless_steel"), "stainless");
  });

  it("rejects unknown materials", () => {
    assert.throws(() => normalizeMaterial("copper"), InputError);
    assert.throws(() => normalizeMaterial("brass"), /unknown material "brass"/);
  });
});
