import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { parseArgs, parseSpec, resolvePart } from "../src/input.js";
import { packageVersion, run } from "../src/run.js";
import { assertClose, captureIO } from "./helpers.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function runCli(args: string[], cwd?: string): { code: number; stdout: string; stderr: string } {
  const captured = captureIO(cwd);
  const code = run(args, captured.io);
  return { code, stdout: captured.stdout(), stderr: captured.stderr() };
}

describe("reference command", () => {
  it("prints the worked example", () => {
    const result = runCli(["--t", "2", "--r", "2", "--angle", "90", "--k", "0.33", "--legs", "50,30"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Bend allowance BA:\s+4\.1783/);
    assert.match(result.stdout, /Outside setback OSSB:\s+4\.0000/);
    assert.match(result.stdout, /Bend deduction BD:\s+3\.8217/);
    assert.match(result.stdout, /Flat length:\s+76\.1783/);
    assert.match(result.stdout, /BA = \(π\/180\)·A·\(R \+ K·T\)/);
  });

  it("accepts equals-form flags and the long names", () => {
    const result = runCli([
      "--thickness=2",
      "--radius=2",
      "--angle=90",
      "--k-factor=0.33",
      "--legs=50,30",
      "--material=steel",
    ]);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Flat length:\s+76\.1783/);
  });

  it("prints JSON for the same command", () => {
    const result = runCli(["--t", "2", "--r", "2", "--angle", "90", "--k", "0.33", "--legs", "50,30", "--json"]);
    assert.equal(result.code, 0);
    const parsed = JSON.parse(result.stdout) as { flatLength: number; material: string };
    assert.equal(parsed.material, "steel");
    assert.equal(parsed.flatLength, 76.178318);
  });
});

describe("multiple bends and the built-in table", () => {
  it("subtracts one deduction per --bend", () => {
    const result = runCli([
      "--t",
      "2",
      "--legs",
      "50,30,20",
      "--bend",
      "90:2",
      "--bend",
      "45:1",
      "--k",
      "0.33",
      "--json",
    ]);
    assert.equal(result.code, 0);
    const parsed = JSON.parse(result.stdout) as {
      flatLength: number;
      totalBendDeduction: number;
      bends: Array<{ angle: number; bendDeduction: number; kFactorSource: string }>;
    };
    assert.equal(parsed.bends.length, 2);
    assert.equal(parsed.bends[0]?.angle, 90);
    assert.equal(parsed.bends[1]?.angle, 45);
    assert.equal(parsed.bends[0]?.kFactorSource, "override");
    assertClose(parsed.flatLength, 100 - parsed.totalBendDeduction, 1e-6);
  });

  it("uses the steel table when --k is omitted", () => {
    const withTable = runCli(["--t", "2", "--r", "2", "--angle", "90", "--legs", "50,30", "--json"]);
    const withOverride = runCli(["--t", "2", "--r", "2", "--angle", "90", "--k", "0.33", "--legs", "50,30", "--json"]);
    const table = JSON.parse(withTable.stdout) as { bends: Array<{ kFactor: number; tableBand: string }> };
    const override = JSON.parse(withOverride.stdout) as { bends: Array<{ kFactor: number }> };
    assert.equal(table.bends[0]?.kFactor, 0.38);
    assert.equal(table.bends[0]?.tableBand, "R/T <= 1");
    assert.equal(override.bends[0]?.kFactor, 0.33);
  });

  it("lets a per-bend K override the global K", () => {
    const result = runCli([
      "--t",
      "2",
      "--material",
      "stainless",
      "--k",
      "0.33",
      "--legs",
      "10,20,10",
      "--bend",
      "90:2",
      "--bend",
      "90:2:0.45",
      "--json",
    ]);
    const parsed = JSON.parse(result.stdout) as {
      material: string;
      bends: Array<{ kFactor: number; kFactorSource: string }>;
    };
    assert.equal(parsed.material, "stainless");
    assert.equal(parsed.bends[0]?.kFactor, 0.33);
    assert.equal(parsed.bends[0]?.kFactorSource, "override");
    assert.equal(parsed.bends[1]?.kFactor, 0.45);
    assert.equal(parsed.bends[1]?.kFactorSource, "bend");
  });
});

describe("spec files", () => {
  it("reads the aluminium bracket example as the reference flat", () => {
    const result = runCli(["--spec", "examples/bracket.json", "--json"], projectRoot);
    assert.equal(result.code, 0, result.stderr);
    const parsed = JSON.parse(result.stdout) as {
      material: string;
      flatLength: number;
      bends: Array<{ kFactor: number; kFactorSource: string }>;
    };
    assert.equal(parsed.material, "aluminium");
    assert.equal(parsed.bends[0]?.kFactor, 0.33);
    assert.equal(parsed.bends[0]?.kFactorSource, "table");
    assert.equal(parsed.flatLength, 76.178318);
  });

  it("reads the channel example and lets --k override the file", () => {
    const fromFile = runCli(["--spec", "examples/channel.json", "--json"], projectRoot);
    assert.equal(fromFile.code, 0, fromFile.stderr);
    const fileJson = JSON.parse(fromFile.stdout) as {
      bends: Array<{ kFactor: number }>;
      flatLength: number;
    };
    assert.equal(fileJson.bends[0]?.kFactor, 0.33);
    assert.equal(fileJson.bends[1]?.kFactor, 0.33);
    // Two identical reference bends: flat = 80 - 2 * BD.
    assertClose(fileJson.flatLength, 80 - 2 * 3.821682, 1e-6);

    const overridden = runCli(["--spec", "examples/channel.json", "--k", "0.5", "--json"], projectRoot);
    const overrideJson = JSON.parse(overridden.stdout) as { bends: Array<{ kFactor: number; kFactorSource: string }> };
    assert.equal(overrideJson.bends[0]?.kFactor, 0.5);
    assert.equal(overrideJson.bends[0]?.kFactorSource, "override");
  });

  it("replaces spec bends with --bend and keeps spec thickness", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "smb-"));
    try {
      writeFileSync(
        path.join(dir, "part.json"),
        JSON.stringify({
          t: 3,
          material: "steel",
          angle: 90,
          r: 3,
          legs: "40,40",
        }),
      );
      const result = runCli(["--spec", "part.json", "--bend", "45:1", "--legs", "12,8", "--json"], dir);
      assert.equal(result.code, 0, result.stderr);
      const parsed = JSON.parse(result.stdout) as {
        thickness: number;
        legs: number[];
        bends: Array<{ angle: number; radius: number }>;
      };
      assert.equal(parsed.thickness, 3);
      assert.deepEqual(parsed.legs, [12, 8]);
      assert.equal(parsed.bends[0]?.angle, 45);
      assert.equal(parsed.bends[0]?.radius, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a missing spec and invalid JSON", () => {
    const missing = runCli(["--spec", "missing-part.json", "--json"]);
    assert.equal(missing.code, 1);
    assert.equal(missing.stdout, "");
    assert.match(missing.stderr, /Error: cannot read spec file "missing-part.json" \(ENOENT\)/);

    const dir = mkdtempSync(path.join(tmpdir(), "smb-"));
    try {
      writeFileSync(path.join(dir, "bad.json"), "{");
      const bad = runCli(["--spec", "bad.json"], dir);
      assert.equal(bad.code, 1);
      assert.match(bad.stderr, /not valid JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("errors and help", () => {
  it("exits non-zero with a clear message for illegal inputs", () => {
    const cases: Array<{ args: string[]; pattern: RegExp }> = [
      { args: ["--t", "0", "--r", "1", "--angle", "90", "--legs", "10,10"], pattern: /thickness T must be a finite number greater than 0/ },
      { args: ["--t", "-2", "--r", "1", "--angle", "90", "--legs", "10,10"], pattern: /got -2/ },
      { args: ["--t", "2", "--r", "-1", "--angle", "90", "--legs", "10,10"], pattern: /inside radius R must be greater than or equal to 0/ },
      { args: ["--t", "2", "--r", "1", "--angle", "180", "--legs", "10,10"], pattern: /less than 180 degrees/ },
      { args: ["--t", "2", "--r", "1", "--angle", "0", "--legs", "10,10"], pattern: /greater than 0 and less than 180/ },
      { args: ["--t", "2", "--r", "1", "--angle", "90", "--k", "0", "--legs", "10,10"], pattern: /K-factor must be greater than 0/ },
      { args: ["--t", "2", "--r", "1", "--angle", "90", "--legs", "10"], pattern: /expected 2 outside leg lengths/ },
      { args: ["--t", "abc", "--r", "1", "--angle", "90", "--legs", "10,10"], pattern: /thickness T expects a number/ },
      { args: ["--material", "copper", "--t", "1", "--r", "1", "--angle", "90", "--legs", "10,10"], pattern: /unknown material "copper"/ },
      { args: ["--bend", "90:1", "--angle", "90", "--r", "1", "--t", "1", "--legs", "10,10"], pattern: /not both/ },
      { args: ["--angle", "90", "--t", "1", "--legs", "10,10"], pattern: /both --angle and --r/ },
      { args: ["--nope"], pattern: /unknown option "--nope"/ },
      { args: ["--t"], pattern: /missing value for --t/ },
      { args: ["position"], pattern: /unexpected argument "position"/ },
      { args: ["--t", "1", "--t", "2", "--r", "1", "--angle", "90", "--legs", "10,10"], pattern: /duplicate option --t/ },
      { args: ["--bend", "90"], pattern: /must be angle:radius/ },
    ];
    for (const sample of cases) {
      const result = runCli(sample.args);
      assert.equal(result.code, 1, sample.args.join(" "));
      assert.equal(result.stdout, "", sample.args.join(" "));
      assert.match(result.stderr, /^Error: /);
      assert.match(result.stderr, sample.pattern, sample.args.join(" "));
    }
  });

  it("shows help and version without calculating", () => {
    const help = runCli(["--t", "--help"]);
    assert.equal(help.code, 0);
    assert.equal(help.stderr, "");
    assert.match(help.stdout, /sheet-metal-bend/);
    assert.match(help.stdout, /--spec/);
    assert.match(help.stdout, /--bend/);
    assert.match(help.stdout, /BA = \(π\/180\)·A·\(R \+ K·T\)/);

    const version = runCli(["--version"]);
    assert.equal(version.code, 0);
    assert.equal(version.stdout, `sheet-metal-bend ${packageVersion()}\n`);
    const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8")) as { version: string };
    assert.equal(packageVersion(), pkg.version);
  });
});

describe("argument and spec parsing", () => {
  it("rejects a spec that mixes bends with a top-level angle", () => {
    assert.throws(
      () =>
        parseSpec(
          JSON.stringify({
            bends: [{ angle: 90, radius: 1 }],
            angle: 45,
            radius: 1,
          }),
          "part.json",
        ),
      /use one form/,
    );
  });

  it("resolves a single-bend spec", () => {
    const spec = parseSpec(
      JSON.stringify({ t: 1.5, material: "Aluminum", angle: 90, r: 1.5, legs: [8, 9], notes: "demo" }),
      "part.json",
    );
    const part = resolvePart(parseArgs([]), spec);
    assert.equal(part.thickness, 1.5);
    assert.equal(part.material, "Aluminum");
    assert.deepEqual(part.bends, [{ angle: 90, radius: 1.5 }]);
    assert.deepEqual(part.legs, [8, 9]);
  });
});

describe("built CLI entry", () => {
  it("runs dist/cli.js for the reference part", () => {
    const cli = path.join(projectRoot, "dist", "cli.js");
    const child = spawnSync(
      process.execPath,
      [cli, "--t", "2", "--r", "2", "--angle", "90", "--k", "0.33", "--legs", "50,30"],
      { encoding: "utf8" },
    );
    assert.equal(child.status, 0, child.stderr);
    assert.match(child.stdout, /Flat length:\s+76\.1783/);
    assert.equal(child.stderr, "");
  });

  it("returns a non-zero status from dist/cli.js for bad input", () => {
    const cli = path.join(projectRoot, "dist", "cli.js");
    const child = spawnSync(process.execPath, [cli, "--t", "0", "--r", "1", "--angle", "90", "--legs", "10,10"], {
      encoding: "utf8",
    });
    assert.notEqual(child.status, 0);
    assert.match(child.stderr, /Error: thickness T must be a finite number greater than 0/);
    assert.equal(child.stdout, "");
  });
});
