import assert from "node:assert/strict";

import type { IO } from "../src/run.js";

export function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  const delta = Math.abs(actual - expected);
  assert.ok(
    delta <= tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected} (delta ${delta})`,
  );
}

export function captureIO(cwd?: string): { io: IO; stdout: () => string; stderr: () => string } {
  let out = "";
  let err = "";
  return {
    io: {
      stdout: {
        write(chunk: string) {
          out += chunk;
        },
      },
      stderr: {
        write(chunk: string) {
          err += chunk;
        },
      },
      ...(cwd === undefined ? {} : { cwd }),
    },
    stdout: () => out,
    stderr: () => err,
  };
}
