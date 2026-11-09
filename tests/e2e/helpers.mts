// E2E Test Suite Helpers & Domain Oracles for SonicBlueprint
// Opaque-box requirement-driven verification across Tiers 1-4.

export type TestFn = () => void | Promise<void>;

export interface TestCase {
  tier: string;
  feature: string;
  name: string;
  fn: TestFn;
}

const registeredCases: TestCase[] = [];
let currentTier = "Tier 1";
let currentFeature = "F1";

export function setContext(tier: string, feature: string): void {
  currentTier = tier;
  currentFeature = feature;
}

export function test(name: string, fn: TestFn): void {
  registeredCases.push({
    tier: currentTier,
    feature: currentFeature,
    name,
    fn,
  });
}

export function getCases(): TestCase[] {
  return registeredCases;
}

export function clearCases(): void {
  registeredCases.length = 0;
}

export class AssertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertError";
  }
}

function fmt(v: unknown): string {
  try {
    const s = JSON.stringify(v);
    return s === undefined ? String(v) : s.slice(0, 300);
  } catch {
    return String(v);
  }
}

export function ok(cond: unknown, msg = "expected truthy value"): asserts cond {
  if (!cond) throw new AssertError(msg);
}

export function eq<T>(actual: T, expected: T, msg = ""): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new AssertError(`${msg} expected ${fmt(expected)}, got ${fmt(actual)}`);
  }
}

export function approx(actual: number, expected: number, eps = 1e-4, msg = ""): void {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || Math.abs(actual - expected) > eps) {
    throw new AssertError(`${msg} expected ≈${expected} (±${eps}), got ${actual}`);
  }
}

export function throws(fn: () => unknown, msg = "expected function to throw"): void {
  try {
    fn();
  } catch {
    return;
  }
  throw new AssertError(msg);
}

export function matches(actual: string, pattern: RegExp, msg = ""): void {
  if (!pattern.test(actual)) {
    throw new AssertError(`${msg} expected ${fmt(actual)} to match ${pattern}`);
  }
}

// ── Domain Reference Oracles (Authoritative Expected Output Derivation) ──

/** Standard 12-TET / Just / Microtonal cents frequency derivation: f = f0 * 2^(cents / 1200) */
export function centsToFreq(baseHz: number, cents: number): number {
  return baseHz * Math.pow(2, cents / 1200);
}

/** Standard Dynamics Compressor transfer curve derivation */
export function calcCompressorGainReduction(
  inputDb: number,
  thresholdDb: number,
  ratio: number
): number {
  if (inputDb <= thresholdDb) return 0;
  return (thresholdDb - inputDb) * (1 - 1 / ratio);
}

/** Linear amplitude to decibels and vice-versa */
export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}
export function gainToDb(gain: number): number {
  return gain > 1e-9 ? 20 * Math.log10(gain) : -180;
}

/** Arpeggiator pattern generator oracle */
export function generateArpSequence(
  notes: number[],
  pattern: "up" | "down" | "upDown" | "random" | "asPlayed",
  octaves: 1 | 2 | 3 = 1,
  seed = 42
): number[] {
  if (notes.length === 0) return [];
  const expanded: number[] = [];
  for (let oct = 0; oct < octaves; oct++) {
    for (const n of notes) {
      expanded.push(n + oct * 12);
    }
  }

  const sorted = [...expanded].sort((a, b) => a - b);
  switch (pattern) {
    case "up":
      return sorted;
    case "down":
      return [...sorted].reverse();
    case "upDown": {
      if (sorted.length <= 1) return sorted;
      const desc = sorted.slice(1, -1).reverse();
      return [...sorted, ...desc];
    }
    case "asPlayed":
      return expanded;
    case "random": {
      // Deterministic PRNG shuffle based on seed
      const copy = [...expanded];
      let s = seed;
      for (let i = copy.length - 1; i > 0; i--) {
        s = (s * 9301 + 49297) % 233280;
        const j = Math.floor((s / 233280) * (i + 1));
        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
      }
      return copy;
    }
  }
}

/** Standard Drop-2 Voicing derivation: takes chord notes sorted ascending, drops 2nd from top by 12 semitones */
export function drop2Voicing(notes: number[]): number[] {
  if (notes.length < 2) return [...notes];
  const sorted = [...notes].sort((a, b) => a - b);
  const secondFromTop = sorted[sorted.length - 2];
  const dropped = secondFromTop - 12;
  const remaining = sorted.filter((_, idx) => idx !== sorted.length - 2);
  return [dropped, ...remaining].sort((a, b) => a - b);
}

/** Relative luminance (WCAG 2.1 AA definition) */
export function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** WCAG 2.1 Contrast ratio: (L1 + 0.05) / (L2 + 0.05) */
export function contrastRatio(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  const l1 = relativeLuminance(...rgb1);
  const l2 = relativeLuminance(...rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** ID3v2.3 Syncsafe integer encoder */
export function encodeSyncSafe(val: number): Uint8Array {
  const res = new Uint8Array(4);
  res[0] = (val >> 21) & 0x7f;
  res[1] = (val >> 14) & 0x7f;
  res[2] = (val >> 7) & 0x7f;
  res[3] = val & 0x7f;
  return res;
}

/** Parse ID3v2 syncsafe integer */
export function decodeSyncSafe(bytes: Uint8Array, offset = 0): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

/** Create minimal valid ID3v2.3 tag buffer with TIT2, TPE1, TALB */
export function createId3v2Tag(meta: { title?: string; artist?: string; album?: string }): Uint8Array {
  const frames: Uint8Array[] = [];

  const addTextFrame = (id: string, text: string) => {
    const textBytes = new TextEncoder().encode(text);
    // 1 byte encoding (0 = ISO-8859-1 / 3 = UTF-8), text, 10 bytes frame header
    const payload = new Uint8Array(1 + textBytes.length);
    payload[0] = 3; // UTF-8
    payload.set(textBytes, 1);

    const frameHeader = new Uint8Array(10);
    for (let i = 0; i < 4; i++) frameHeader[i] = id.charCodeAt(i);
    // Frame size (big endian, non-syncsafe in v2.3)
    const sz = payload.length;
    frameHeader[4] = (sz >> 24) & 0xff;
    frameHeader[5] = (sz >> 16) & 0xff;
    frameHeader[6] = (sz >> 8) & 0xff;
    frameHeader[7] = sz & 0xff;
    frameHeader[8] = 0; // flags
    frameHeader[9] = 0;

    const fullFrame = new Uint8Array(10 + payload.length);
    fullFrame.set(frameHeader, 0);
    fullFrame.set(payload, 10);
    frames.push(fullFrame);
  };

  if (meta.title) addTextFrame("TIT2", meta.title);
  if (meta.artist) addTextFrame("TPE1", meta.artist);
  if (meta.album) addTextFrame("TALB", meta.album);

  const totalPayloadSize = frames.reduce((a, b) => a + b.length, 0);
  const header = new Uint8Array(10);
  header[0] = 0x49; // 'I'
  header[1] = 0x44; // 'D'
  header[2] = 0x33; // '3'
  header[3] = 3;    // version 2.3
  header[4] = 0;    // revision 0
  header[5] = 0;    // flags
  const syncSafeSize = encodeSyncSafe(totalPayloadSize);
  header.set(syncSafeSize, 6);

  const out = new Uint8Array(10 + totalPayloadSize);
  out.set(header, 0);
  let off = 10;
  for (const f of frames) {
    out.set(f, off);
    off += f.length;
  }
  return out;
}

/** Semi-implicit Euler spring simulation step */
export function stepSpring(
  current: number,
  velocity: number,
  target: number,
  stiffness = 180,
  damping = 12,
  mass = 1,
  dt = 1 / 60
): { current: number; velocity: number } {
  const force = -stiffness * (current - target) - damping * velocity;
  const accel = force / Math.max(1e-3, mass);
  const newVelocity = velocity + accel * dt;
  const newCurrent = current + newVelocity * dt;
  return { current: newCurrent, velocity: newVelocity };
}
