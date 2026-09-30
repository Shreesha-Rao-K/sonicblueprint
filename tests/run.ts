// Test runner: imports every suite, executes cases in order, reports failures.
// Usage: npm test   (tsx tests/run.ts)

import { getCases } from "./helpers.js";

import "./music-theory.test.js";
import "./project-schema.test.js";
import "./presets.test.js";
import "./song-events.test.js";
import "./layers.test.js";
import "./security.test.js";
import "./exports.test.js";

async function main(): Promise<void> {
  const cases = getCases();
  let pass = 0;
  const failures: string[] = [];

  for (const c of cases) {
    try {
      await c.fn();
      pass++;
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      failures.push(`${c.suite} › ${c.name} :: ${detail}`);
      console.log(`FAIL ${c.suite} › ${c.name} :: ${detail}`);
    }
  }

  console.log(`\nTESTS: ${pass} passed, ${failures.length} failed (${cases.length} total)`);
  if (failures.length > 0) process.exit(1);
}

void main();
