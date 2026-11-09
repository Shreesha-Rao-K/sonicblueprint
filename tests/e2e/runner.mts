// SonicBlueprint Comprehensive Opaque-Box E2E Test Runner
// Tiers 1-4 Full Verification Suite
// Usage: npx tsx tests/e2e/runner.mts

import { getCases } from "./helpers.mjs";

// Load all tier suites
import "./tier1-feature.test.mjs";
import "./tier2-boundary.test.mjs";
import "./tier3-pairwise.test.mjs";
import "./tier4-workload.test.mjs";
import "./tier5-adversarial.test.mjs";

interface TierStats {
  total: number;
  pass: number;
  fail: number;
}

async function main(): Promise<void> {
  const startTime = performance.now();
  const cases = getCases();

  console.log("=".repeat(78));
  console.log("  SONICBLUEPRINT FULL-SPECTRUM E2E TEST SUITE (TIERS 1-5)");
  console.log("  Total Test Cases Registered: " + cases.length);
  console.log("=".repeat(78) + "\n");

  const tierMap = new Map<string, TierStats>();
  const failures: { tier: string; feature: string; name: string; error: string }[] = [];
  let passCount = 0;

  for (let i = 0; i < cases.length; i++) {
    const c = cases[i];
    if (!tierMap.has(c.tier)) {
      tierMap.set(c.tier, { total: 0, pass: 0, fail: 0 });
    }
    const stats = tierMap.get(c.tier)!;
    stats.total++;

    try {
      await c.fn();
      stats.pass++;
      passCount++;
    } catch (err) {
      stats.fail++;
      const msg = err instanceof Error ? err.message : String(err);
      failures.push({
        tier: c.tier,
        feature: c.feature,
        name: c.name,
        error: msg,
      });
      console.error(`  FAIL [${c.tier}] ${c.feature} › ${c.name}\n       ${msg}`);
    }
  }

  const elapsedSec = ((performance.now() - startTime) / 1000).toFixed(2);

  console.log("\n" + "-".repeat(78));
  console.log("  TIER BREAKDOWN & EXECUTION SUMMARY");
  console.log("-".repeat(78));
  console.log(
    "  " +
    "Tier".padEnd(28) +
    "Total".padStart(8) +
    "Passed".padStart(10) +
    "Failed".padStart(10) +
    "Pass Rate".padStart(12)
  );
  console.log("  " + "-".repeat(68));

  for (const [tier, stats] of tierMap.entries()) {
    const rate = ((stats.pass / stats.total) * 100).toFixed(1) + "%";
    console.log(
      "  " +
      tier.padEnd(28) +
      String(stats.total).padStart(8) +
      String(stats.pass).padStart(10) +
      String(stats.fail).padStart(10) +
      rate.padStart(12)
    );
  }

  console.log("  " + "-".repeat(68));
  const overallRate = ((passCount / cases.length) * 100).toFixed(1) + "%";
  console.log(
    "  " +
    "TOTAL (All Tiers)".padEnd(28) +
    String(cases.length).padStart(8) +
    String(passCount).padStart(10) +
    String(failures.length).padStart(10) +
    overallRate.padStart(12)
  );
  console.log("-".repeat(78));
  console.log(`  Time Elapsed: ${elapsedSec}s`);

  if (failures.length > 0) {
    console.error(`\n  FAILED: ${failures.length} test(s) failed.`);
    for (const f of failures) {
      console.error(`    - [${f.tier}] ${f.feature} :: ${f.name} -> ${f.error}`);
    }
    process.exit(1);
  }

  console.log("\n  ALL TESTS PASSED SUCCESSFULLY (Exit Code 0).\n");
  process.exit(0);
}

void main();
