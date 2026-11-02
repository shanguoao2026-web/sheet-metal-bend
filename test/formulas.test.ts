import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bendAllowance, bendDeduction, flatLength, outsideSetback } from "../src/formulas.js";
import { assertClose } from "./helpers.js";

/**
 * Hand-computed reference, T=2, R=2, A=90, K=0.33.
 *
 * BA = (π/180)*90*(2 + 0.33*2) = (π/2)*2.66
 *    π/2 = 1.5707963267948966
 *    * 2.66 = 4.178318229274425
 * OSSB = tan(45°)*(2+2) = 4
 * BD = 2*4 - 4.178318229274425 = 3.821681770725575
 * Flat = 50+30 - BD = 76.17831822927442
 */
const BA_REF = 4.178318229274425;
const OSSB_REF = 4;
const BD_REF = 3.821681770725575;
const FLAT_REF = 76.17831822927442;

describe("reference bend T=2 R=2 A=90 K=0.33", () => {
  const ba = bendAllowance(90, 2, 0.33, 2);
  const ossb = outsideSetback(90, 2, 2);
  const bd = bendDeduction(ossb, ba);
  const flat = flatLength([50, 30], [bd]);

  it("matches the hand-computed allowance, setback, deduction, and flat length", () => {
    assertClose(ba, BA_REF, 1e-12);
    assertClose(ossb, OSSB_REF, 1e-12);
    assertClose(bd, BD_REF, 1e-12);
    assertClose(flat, FLAT_REF, 1e-12);
  });

  it("rounds to the published shop values", () => {
    assert.equal(ba.toFixed(2), "4.18");
    assert.equal(ossb.toFixed(2), "4.00");
    assert.equal(bd.toFixed(2), "3.82");
    assert.equal(flat.toFixed(2), "76.18");
  });

  it("keeps the setback form and the allowance form equal", () => {
    const byAllowance = 50 - ossb + ba + (30 - ossb);
    assertClose(flat, byAllowance, 1e-12);
    assertClose(bd, 2 * ossb - ba, 1e-12);
  });
});

describe("other hand-computed bends", () => {
  it("computes a 60 degree bend", () => {
    // BA = (π/180)*60*(3 + 0.5*1) = (π/3)*3.5 = 3.665191429188092
    // OSSB = tan(30°)*(3+1) = 4/√3 = 2.309401076758503
    // BD = 2*OSSB - BA = 0.953610724328914
    // Flat = 20+10 - BD = 29.046389275671086
    const ba = bendAllowance(60, 3, 0.5, 1);
    const ossb = outsideSetback(60, 3, 1);
    const bd = bendDeduction(ossb, ba);
    assertClose(ba, 3.665191429188092, 1e-12);
    assertClose(ossb, 2.309401076758503, 1e-12);
    assertClose(bd, 0.953610724328914, 1e-12);
    assertClose(flatLength([20, 10], [bd]), 29.046389275671086, 1e-12);
  });

  it("computes a 120 degree bend", () => {
    // BA = (π/180)*120*(4 + 0.4*2) = (2π/3)*4.8 = 10.053096491487336
    // OSSB = tan(60°)*(4+2) = √3*6 = 10.392304845413264
    // BD = 10.731513199339185
    // Flat = 30+15 - BD = 34.268486800660815
    const ba = bendAllowance(120, 4, 0.4, 2);
    const ossb = outsideSetback(120, 4, 2);
    const bd = bendDeduction(ossb, ba);
    assertClose(ba, 10.053096491487336, 1e-12);
    assertClose(ossb, 10.392304845413264, 1e-9);
    assertClose(bd, 10.731513199339185, 1e-9);
    assertClose(flatLength([30, 15], [bd]), 34.26848680066082, 1e-9);
  });

  it("allows a sharp inside radius of zero", () => {
    // BA = (π/2)*(0 + 0.38*1.5) = (π/2)*0.57 = 0.8953539062730911
    // OSSB = 1.5
    // BD = 3 - BA = 2.1046460937269087
    // Flat = 16 - BD = 13.895353906273091
    const ba = bendAllowance(90, 0, 0.38, 1.5);
    const ossb = outsideSetback(90, 0, 1.5);
    const bd = bendDeduction(ossb, ba);
    assertClose(ba, 0.8953539062730911, 1e-12);
    assertClose(ossb, 1.5, 1e-12);
    assertClose(bd, 2.1046460937269087, 1e-12);
    assertClose(flatLength([8, 8], [bd]), 13.895353906273091, 1e-12);
  });

  it("subtracts one deduction per bend", () => {
    const bd = bendDeduction(outsideSetback(90, 2, 2), bendAllowance(90, 2, 0.33, 2));
    assertClose(flatLength([20, 40, 20], [bd, bd]), 80 - 2 * bd, 1e-12);
  });
});
