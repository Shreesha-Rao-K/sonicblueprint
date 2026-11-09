#!/usr/bin/env tsx
/**
 * SonicBlueprint Master Guardrail Runner
 * Executes the 5 mandatory quality gates in fail-fast sequence:
 * 1. TypeScript Strict Invariant Check (tsc --noEmit)
 * 2. ESLint Code Quality Scan (eslint)
 * 3. SAST Security & Secret Audit (tsx scripts/security-audit.mts)
 * 4. Unit & Integration Test Suite (tsx tests/run.ts)
 * 5. Audio Engine Regression QA (tsx qa/audio-qa.mts)
 */

import { execSync } from "node:child_process";
import { performance } from "node:perf_hooks";

interface Gate {
  name: string;
  command: string;
}

const GATES: Gate[] = [
  { name: "TypeScript Invariants", command: "npm run typecheck" },
  { name: "ESLint Quality Rules", command: "npm run lint" },
  { name: "SAST Security Audit", command: "npx tsx scripts/security-audit.mts" },
  { name: "Unit & Integration Tests", command: "npm test" },
  { name: "Audio Engine Regression QA", command: "npx tsx qa/audio-qa.mts" },
];

function runGate(gate: Gate, index: number, total: number): boolean {
  process.stdout.write(`[${index + 1}/${total}] ${gate.name.padEnd(30, ".")} `);
  const start = performance.now();
  try {
    execSync(gate.command, {
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf-8",
    });
    const dur = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`\x1b[32m[PASS]\x1b[0m (${dur}s)`);
    return true;
  } catch (err: unknown) {
    const dur = ((performance.now() - start) / 1000).toFixed(1);
    console.log(`\x1b[31m[FAIL]\x1b[0m (${dur}s)`);
    const e = err as { stdout?: string; stderr?: string };
    if (e.stdout) console.log(e.stdout.trim());
    if (e.stderr) console.error(e.stderr.trim());
    return false;
  }
}

function main() {
  console.log("\n🚀 SonicBlueprint Pre-Commit Quality Guardrails\n");
  const overallStart = performance.now();

  for (let i = 0; i < GATES.length; i++) {
    const currentGate = GATES[i];
    if (!currentGate) continue;
    const success = runGate(currentGate, i, GATES.length);
    if (!success) {
      console.error(`\n❌ Guardrail check failed at step ${i + 1}: ${currentGate.name}`);
      console.error("Please resolve the issue above before committing or creating a pull request.\n");
      process.exit(1);
    }
  }

  const totalTime = ((performance.now() - overallStart) / 1000).toFixed(1);
  console.log(`\n\x1b[32m✨ ALL 5 GUARDRAIL GATES PASSED in ${totalTime}s!\x1b[0m Ready to commit.\n`);
  process.exit(0);
}

main();
