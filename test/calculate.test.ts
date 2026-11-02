import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateFlatPattern } from "../src/calculate.js";
import { formatJson, formatText } from "../src/format.js";
import { assertClose } from "./helpers.js";

const reference = {
  thickness: 2,
  material: "steel",
  kFactor: 0.33,
  legs: [50, 30],
  bends: [{ angle: 90, radius: 2 }],
};

describe("calculateFlatPattern reference part", () => {
  const result = calculateFlatPattern(reference);

  it("reports the hand-computed flat pattern", () => {
    assert.equal(result.bends.length, 1);
    const bend = result.bends[0];
    assert.ok(bend);
    assertClose(bend.bendAllowance, 4.178318229274425, 1e-12);
    assertClose(bend.outsideSetback, 4, 1e-12);
    assertClose(bend.bendDeduction, 3.821681770725575, 1e-12);
    assertClose(result.flatLength, 76.17831822927442, 1e-12);
    assert.equal(bend.bendAllowance.toFixed(2), "4.18");
    assert.equal(bend.outsideSetback.toFixed(2), "4.00");
    assert.equal(bend.bendDeduction.toFixed(2), "3.82");
    assert.equal(result.flatLength.toFixed(2), "76.18");
    assert.equal(bend.kFactor, 0.33);
    assert.equal(bend.kFactorSource, "override");
    assert.equal(result.sumOfLegs, 80);
  });

  it("prints BA, OSSB, BD, and flat length", () => {
    const text = formatText(result);
    assert.match(text, /BA = \(π\/180\)·A·\(R \+ K·T\)/);
    assert.match(text, /OSSB = tan\(A\/2\)·\(R\+T\)/);
    assert.match(text, /BD = 2·OSSB − BA/);
    assert.match(text, /flat length = sum of outside leg lengths − BD per bend/);
    assert.match(text, /Bend allowance BA:\s+4\.1783/);
    assert.match(text, /Outside setback OSSB:\s+4\.0000/);
    assert.match(text, /Bend deduction BD:\s+3\.8217/);
    assert.match(text, /Flat length:\s+76\.1783/);
    assert.match(text, /user override/);
  });

  it("emits JSON that still satisfies BD = 2·OSSB − BA", () => {
    const parsed = JSON.parse(formatJson(result)) as {
      flatLength: number;
      bends: Array<{ bendAllowance: number; outsideSetback: number; bendDeduction: number; kFactor: number }>;
    };
    assert.equal(parsed.bends[0]?.kFactor, 0.33);
    assert.equal(parsed.bends[0]?.bendAllowance, 4.178318);
    assert.equal(parsed.bends[0]?.outsideSetback, 4);
    assert.equal(parsed.bends[0]?.bendDeduction, 3.821682);
    assert.equal(parsed.flatLength, 76.178318);
    const bend = parsed.bends[0];
    assert.ok(bend);
    assertClose(bend.bendDeduction, 2 * bend.outsideSetback - bend.bendAllowance, 1e-9);
  });
});

describe("table K and several bends", () => {
  it("uses steel K = 0.38 when R/T is 1 and --k is omitted", () => {
    const result = calculateFlatPattern({
      thickness: 2,
      material: "steel",
      legs: [50, 30],
      bends: [{ angle: 90, radius: 2 }],
    });
    const bend = result.bends[0];
    assert.ok(bend);
    assert.equal(bend.kFactor, 0.38);
    assert.equal(bend.kFactorSource, "table");
    assert.equal(bend.tableBand, "R/T <= 1");
    // BA = (π/2)*(2 + 0.38*2) = (π/2)*2.76 = 4.335397861953915
    assertClose(bend.bendAllowance, 4.335397861953915, 1e-12);
    assertClose(result.flatLength, 76.33539786195392, 1e-9);
  });

  it("uses aluminium K = 0.33 at R/T = 1, matching the reference flat", () => {
    const result = calculateFlatPattern({
      thickness: 2,
      material: "aluminum",
      legs: [50, 30],
      bends: [{ angle: 90, radius: 2 }],
    });
    assert.equal(result.material, "aluminium");
    assertClose(result.flatLength, 76.17831822927442, 1e-9);
    assert.equal(result.bends[0]?.kFactorSource, "table");
  });

  it("picks a different table K for each bend", () => {
    const result = calculateFlatPattern({
      thickness: 2,
      material: "steel",
      legs: [40, 25, 15],
      bends: [
        { angle: 90, radius: 2 },
        { angle: 90, radius: 8 },
      ],
    });
    assert.equal(result.bends[0]?.kFactor, 0.38);
    assert.equal(result.bends[0]?.tableBand, "R/T <= 1");
    assert.equal(result.bends[1]?.kFactor, 0.5);
    assert.equal(result.bends[1]?.tableBand, "R/T > 3");
    assertClose(result.totalBendDeduction, result.bends[0]!.bendDeduction + result.bends[1]!.bendDeduction, 1e-12);
    assertClose(result.flatLength, 80 - result.totalBendDeduction, 1e-12);
  });

  it("lets a per-bend K beat the global override", () => {
    const result = calculateFlatPattern({
      thickness: 2,
      material: "stainless",
      kFactor: 0.33,
      legs: [10, 20, 10],
      bends: [
        { angle: 90, radius: 2 },
        { angle: 90, radius: 2, kFactor: 0.42 },
      ],
    });
    assert.equal(result.bends[0]?.kFactor, 0.33);
    assert.equal(result.bends[0]?.kFactorSource, "override");
    assert.equal(result.bends[1]?.kFactor, 0.42);
    assert.equal(result.bends[1]?.kFactorSource, "bend");
  });
});

describe("validation", () => {
  it("rejects thickness, radius, angle, K, and leg errors", () => {
    assert.throws(
      () => calculateFlatPattern({ ...reference, thickness: 0 }),
      /thickness T must be a finite number greater than 0/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, thickness: -1 }),
      /got -1/,
    );
    assert.throws(
      () =>
        calculateFlatPattern({
          ...reference,
          bends: [{ angle: 180, radius: 2 }],
        }),
      /less than 180 degrees \(got 180\)/,
    );
    assert.throws(
      () =>
        calculateFlatPattern({
          ...reference,
          bends: [{ angle: 0, radius: 2 }],
        }),
      /greater than 0 and less than 180/,
    );
    assert.throws(
      () =>
        calculateFlatPattern({
          ...reference,
          bends: [{ angle: 90, radius: -0.1 }],
        }),
      /inside radius R must be greater than or equal to 0/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, kFactor: 0 }),
      /K-factor must be greater than 0 and at most 1 \(got 0\)/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, kFactor: 1.01 }),
      /got 1\.01/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, legs: [50] }),
      /expected 2 outside leg lengths for 1 bend, got 1/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, legs: [50, 0] }),
      /leg 2 must be a finite number greater than 0/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, bends: [], legs: [50] }),
      /at least one bend is required/,
    );
    assert.throws(
      () => calculateFlatPattern({ ...reference, material: "titanium" }),
      /unknown material "titanium"/,
    );
  });

  it("accepts K = 1 and an angle just inside the open interval", () => {
    const result = calculateFlatPattern({
      ...reference,
      kFactor: 1,
      bends: [{ angle: 179.999, radius: 0 }],
    });
    assert.equal(result.bends[0]?.kFactor, 1);
    assert.ok(Number.isFinite(result.flatLength));
  });
});
