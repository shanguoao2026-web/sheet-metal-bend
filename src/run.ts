import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { calculateFlatPattern } from "./calculate.js";
import { formatJson, formatText } from "./format.js";
import { HELP } from "./help.js";
import { loadSpec, parseArgs, resolvePart } from "./input.js";

export interface TextWriter {
  write(chunk: string): void;
}

export interface IO {
  stdout: TextWriter;
  stderr: TextWriter;
  cwd?: string;
}

function defaultIo(): IO {
  return {
    stdout: process.stdout,
    stderr: process.stderr,
  };
}

function hasFlag(argv: string[], names: readonly string[]): boolean {
  return argv.some((arg) => {
    const eq = arg.indexOf("=");
    const flag = eq === -1 ? arg : arg.slice(0, eq);
    return names.includes(flag);
  });
}

/** Walk up from this module to the project package.json. */
export function packageVersion(): string {
  let dir = path.dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i += 1) {
    const candidate = path.join(dir, "package.json");
    try {
      const parsed = JSON.parse(readFileSync(candidate, "utf8")) as {
        name?: string;
        version?: string;
      };
      if (parsed.name === "sheet-metal-bend" && typeof parsed.version === "string") {
        return parsed.version;
      }
    } catch {
      // Not this directory. Keep walking toward the filesystem root.
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return "0.0.0";
}

/**
 * Run the CLI. Returns a process exit code and never calls process.exit,
 * so tests can invoke it in-process.
 */
export function run(argv: string[], io: IO = defaultIo()): number {
  try {
    if (hasFlag(argv, ["--help", "-h"])) {
      io.stdout.write(HELP);
      return 0;
    }
    if (hasFlag(argv, ["--version"])) {
      io.stdout.write(`sheet-metal-bend ${packageVersion()}\n`);
      return 0;
    }
    const cli = parseArgs(argv);
    const cwd = io.cwd ?? process.cwd();
    const spec = cli.specPath === undefined ? undefined : loadSpec(cli.specPath, cwd);
    const part = resolvePart(cli, spec);
    const result = calculateFlatPattern(part);
    io.stdout.write(cli.json ? formatJson(result) : formatText(result));
    return 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    io.stderr.write(`Error: ${message}\n`);
    return 1;
  }
}
