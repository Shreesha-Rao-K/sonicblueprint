// ── Multi-Pattern Instrument Arpeggiator Core ──
// Pure functions for algorithmic note arpeggiation.
// Supports Up, Down, UpDown (bounce), Random, and AsPlayed patterns
// across 1–3 octaves and metric/triplet sync rates.
// Deterministic and zero-dependency: identical offline and realtime output.

export type ArpPattern = "up" | "down" | "upDown" | "random" | "asPlayed";
export type ArpRate = "1/4" | "1/8" | "1/16" | "1/8t" | "1/16t";
export type ArpOctaves = 1 | 2 | 3;

export interface ArpeggiatorConfig {
  enabled: boolean;
  pattern: ArpPattern;
  rate: ArpRate;
  octaves: ArpOctaves;
  gate?: number | undefined; // duration ratio per step: 0.1..1.0 (default 0.85)
}

export const ARP_PATTERNS: ArpPattern[] = ["up", "down", "upDown", "random", "asPlayed"];
export const ARP_RATES: ArpRate[] = ["1/4", "1/8", "1/16", "1/8t", "1/16t"];

export function defaultArpeggiatorConfig(): ArpeggiatorConfig {
  return {
    enabled: true,
    pattern: "up",
    rate: "1/16",
    octaves: 1,
    gate: 0.85,
  };
}

/** Sanitize and normalize arpeggiator configuration against unknown or corrupt inputs. */
export function normalizeArpeggiatorConfig(raw?: unknown): ArpeggiatorConfig {
  const def = defaultArpeggiatorConfig();
  if (typeof raw !== "object" || raw === null) return def;
  const r = raw as Record<string, unknown>;

  const pattern =
    typeof r["pattern"] === "string" && ARP_PATTERNS.includes(r["pattern"] as ArpPattern)
      ? (r["pattern"] as ArpPattern)
      : def.pattern;

  const rate =
    typeof r["rate"] === "string" && ARP_RATES.includes(r["rate"] as ArpRate)
      ? (r["rate"] as ArpRate)
      : def.rate;

  let octaves: ArpOctaves = def.octaves;
  if (r["octaves"] === 1 || r["octaves"] === 2 || r["octaves"] === 3) {
    octaves = r["octaves"] as ArpOctaves;
  } else if (typeof r["octaves"] === "number" && Number.isFinite(r["octaves"])) {
    const clamped = Math.max(1, Math.min(3, Math.round(r["octaves"])));
    octaves = clamped as ArpOctaves;
  }

  const gate =
    typeof r["gate"] === "number" && Number.isFinite(r["gate"])
      ? Math.max(0.1, Math.min(1.0, r["gate"]))
      : def.gate;

  const enabled = typeof r["enabled"] === "boolean" ? r["enabled"] : def.enabled;

  return { enabled, pattern, rate, octaves, gate };
}

/** Duration in quarter-note beats for a given sync rate. */
export function rateToBeatFraction(rate: ArpRate): number {
  switch (rate) {
    case "1/4":
      return 1.0;
    case "1/8":
      return 0.5;
    case "1/16":
      return 0.25;
    case "1/8t":
      return 1 / 3; // 0.3333... beats
    case "1/16t":
      return 1 / 6; // 0.1666... beats
    default:
      return 0.25;
  }
}

/** Number of arpeggiator steps per bar given a time signature. */
export function rateToStepsPerBar(rate: ArpRate, beatsPerBar = 4): number {
  const fraction = rateToBeatFraction(rate);
  return Math.max(1, Math.round(beatsPerBar / fraction));
}

/** Deterministic pseudo-random number generator for reproducible 'random' pattern. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/**
 * Expand notes across octaves based on the pattern requirement.
 * For 'asPlayed', preserves original order; for others, sorts ascending.
 */
export function expandOctaves(notes: number[], octaves: ArpOctaves, preserveOrder = false): number[] {
  if (notes.length === 0) return [];
  const validNotes = notes.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (validNotes.length === 0) return [];

  const base = preserveOrder ? validNotes : Array.from(new Set(validNotes)).sort((a, b) => a - b);

  const pool: number[] = [];
  for (let o = 0; o < octaves; o++) {
    const shift = o * 12;
    for (const note of base) {
      pool.push(note + shift);
    }
  }
  return pool;
}

/**
 * Build one complete cycle of note indices for the bounce (upDown) pattern.
 * Avoids repeating top and bottom extremes: [0, 1, 2, 1] instead of [0, 1, 2, 2, 1, 0].
 */
export function buildUpDownCycle(pool: number[]): number[] {
  if (pool.length <= 1) return [...pool];
  if (pool.length === 2) return [pool[0], pool[1]];

  const cycle: number[] = [...pool];
  for (let i = pool.length - 2; i >= 1; i--) {
    cycle.push(pool[i]);
  }
  return cycle;
}

/**
 * Pure function: Arpeggiates an array of chord notes into a sequence of pitches.
 * 
 * @param notes Array of MIDI note numbers representing the chord
 * @param config Arpeggiator configuration (pattern, rate, octaves)
 * @param stepCount Total number of steps to generate in output
 * @param seed Optional seed for deterministic random pattern
 * @returns Array of MIDI note numbers of length stepCount
 */
export function arpeggiateChord(
  notes: number[],
  config: ArpeggiatorConfig,
  stepCount: number,
  seed?: string | undefined
): number[] {
  if (stepCount <= 0 || !Array.isArray(notes) || notes.length === 0) {
    return [];
  }

  const cfg = normalizeArpeggiatorConfig(config);
  const isAsPlayed = cfg.pattern === "asPlayed";
  const pool = expandOctaves(notes, cfg.octaves, isAsPlayed);

  if (pool.length === 0) return [];
  if (pool.length === 1) {
    return Array.from({ length: stepCount }, () => pool[0]);
  }

  const out: number[] = [];

  switch (cfg.pattern) {
    case "up": {
      for (let i = 0; i < stepCount; i++) {
        out.push(pool[i % pool.length]);
      }
      break;
    }
    case "down": {
      const downPool = [...pool].reverse();
      for (let i = 0; i < stepCount; i++) {
        out.push(downPool[i % downPool.length]);
      }
      break;
    }
    case "upDown": {
      const cycle = buildUpDownCycle(pool);
      for (let i = 0; i < stepCount; i++) {
        out.push(cycle[i % cycle.length]);
      }
      break;
    }
    case "asPlayed": {
      for (let i = 0; i < stepCount; i++) {
        out.push(pool[i % pool.length]);
      }
      break;
    }
    case "random": {
      const randSeed = seed ?? `arp-rnd:${notes.join(",")}:${cfg.octaves}:${stepCount}`;
      const prng = seededRandom(randSeed);
      for (let i = 0; i < stepCount; i++) {
        const idx = Math.floor(prng() * pool.length);
        out.push(pool[idx]);
      }
      break;
    }
  }

  return out;
}

export interface ArpScheduledNote {
  time: number; // Start time in seconds
  midi: number; // Pitched MIDI note
  dur: number; // Active duration in seconds
  vol: number; // Velocity / volume
  pan: number; // Stereo pan
  stepIndex: number; // Step index
}

/**
 * Generate fully scheduled note events for a chord slot within a time window.
 * Useful for direct inclusion into buildSongEvents().
 */
export function generateArpEvents(
  chordMidis: number[],
  config: ArpeggiatorConfig,
  startTimeSec: number,
  totalDurSec: number,
  spq: number, // Seconds per quarter note
  options?: {
    volume?: number | undefined;
    pan?: number | undefined;
    seed?: string | undefined;
    accentFirstStep?: boolean | undefined;
  } | undefined
): ArpScheduledNote[] {
  const cfg = normalizeArpeggiatorConfig(config);
  const stepDurSec = rateToBeatFraction(cfg.rate) * spq;
  const stepCount = Math.max(1, Math.floor(totalDurSec / stepDurSec));
  const pitches = arpeggiateChord(chordMidis, cfg, stepCount, options?.seed);

  const baseVol = options?.volume ?? 0.7;
  const pan = options?.pan ?? 0;
  const gate = cfg.gate ?? 0.85;
  const activeDur = stepDurSec * gate;

  const events: ArpScheduledNote[] = [];
  for (let s = 0; s < pitches.length; s++) {
    const isAccent = options?.accentFirstStep && s === 0;
    const vol = isAccent ? Math.min(1.0, baseVol * 1.15) : baseVol;
    events.push({
      time: startTimeSec + s * stepDurSec,
      midi: pitches[s],
      dur: activeDur,
      vol,
      pan,
      stepIndex: s,
    });
  }
  return events;
}

/** Alias for generateArpEvents */
export const generateArpNoteEvents = generateArpEvents;
