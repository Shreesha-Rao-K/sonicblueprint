// Minimal deterministic test helpers (no framework).
// Each *.test.mts registers cases via test(); tests/run.mts executes them.

export type TestFn = () => void | Promise<void>;

interface Case {
  suite: string;
  name: string;
  fn: TestFn;
}

const cases: Case[] = [];
let currentSuite = "";

export function suite(name: string): void {
  currentSuite = name;
}

export function test(name: string, fn: TestFn): void {
  cases.push({ suite: currentSuite || "default", name, fn });
}

export function getCases(): Case[] {
  return cases;
}

function fmt(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s.slice(0, 300);
  } catch {
    return String(v);
  }
}

export class AssertError extends Error {}

export function ok(cond: unknown, msg = ""): asserts cond {
  if (!cond) throw new AssertError(msg || "expected truthy value");
}

export function eq<T>(actual: T, expected: T, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new AssertError(`${msg} expected ${fmt(expected)}, got ${fmt(actual)}`);
  }
}

export function approx(actual: number, expected: number, eps = 1e-6, msg = ""): void {
  if (Math.abs(actual - expected) > eps) {
    throw new AssertError(`${msg} expected ≈${expected}, got ${actual}`);
  }
}

export function throws(fn: () => unknown, msg = ""): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new AssertError(`${msg} expected function to throw`);
}
