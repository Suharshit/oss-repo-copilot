#!/usr/bin/env node
// Runs the same checks as CI (.github/workflows/ci.yml) and prints a summary.
// Usage: pnpm verify            (runs every step, reports all failures)
//        pnpm verify --bail     (stops at the first failing step)

import { spawnSync } from "node:child_process";

const turbo = (task) => [
  "exec",
  "turbo",
  "run",
  task,
  "--ui=stream",
  "--continue",
];

const steps = [
  { name: "format", args: ["format:check"] },
  { name: "lint", args: turbo("lint") },
  { name: "typecheck", args: turbo("check-types") },
  { name: "test", args: turbo("test") },
  { name: "build", args: turbo("build") },
];

const bail = process.argv.includes("--bail");
const results = [];

for (const step of steps) {
  console.log(`\n▶ ${step.name}\n`);
  const start = Date.now();
  const { status } = spawnSync("pnpm", step.args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const ok = status === 0;
  results.push({ ...step, ok, secs: ((Date.now() - start) / 1000).toFixed(1) });
  if (!ok && bail) break;
}

console.log("\n── verify summary ──");
for (const r of results) {
  console.log(`${r.ok ? "✔" : "✖"} ${r.name.padEnd(10)} ${r.secs}s`);
}
for (const s of steps.slice(results.length)) {
  console.log(`- ${s.name.padEnd(10)} skipped`);
}

process.exit(
  results.every((r) => r.ok) && results.length === steps.length ? 0 : 1,
);
