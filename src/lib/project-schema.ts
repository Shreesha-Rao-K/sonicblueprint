// ── Project schema v5: versioned JSON, defaults, validation ──
// v1: original release. v2: layer toggles (migrated ON). v3: version history.
// v4: performance humanization preference (defaults to subtle = legacy sound).
// v5: master effects (reverb, delay, EQ) with safe neutral bypass defaults.

export const SCHEMA_VERSION = 5;

import { normalizeLevel, type HumanizeLevel } from "./humanize";
import {
  defaultMasterFx,
  normalizeMasterFx,
  type MasterFxConfig,
} from "./audio-effects";
import type { ArpeggiatorConfig } from "./arpeggiator";

/** Cap on stored versions per project: full snapshots are ~3KB each, so 20
 * versions stay well under 100KB — trivial for IndexedDB and JSON backups. */
export const MAX_VERSIONS = 20;

export type LayerId = "chords" | "drums" | "bass" | "melody";

/** Per-layer participation switches. Disabling a layer removes it from
 * playback and exports without touching its musical configuration. */
export interface LayerState {
  chords: boolean;
  drums: boolean;
  bass: boolean;
  melody: boolean;
}

export const LAYER_IDS: LayerId[] = ["chords", "drums", "bass", "melody"];

export function defaultLayers(): LayerState {
  return { chords: true, drums: true, bass: true, melody: true };
}

/** Single source of truth for layer state: merges stored flags over ON defaults. */
export function getLayers(p: SonicProject): LayerState {
  const stored = (p.layers ?? {}) as Partial<Record<LayerId, unknown>>;
  const out = defaultLayers();
  for (const id of LAYER_IDS) {
    if (typeof stored[id] === "boolean") out[id] = stored[id] as boolean;
  }
  return out;
}

export type TimeSignature = "4/4" | "3/4" | "6/8" | "12/8";
export type ScaleKind =
  | "major"
  | "minor"
  | "dorian"
  | "mixolydian"
  | "phrygian"
  | "lydian"
  | "harmonicMinor"
  | "pentMajor"
  | "pentMinor"
  | "blues";

export type ChordVoicing = "root" | "firstInversion" | "secondInversion" | "thirdInversion" | "open" | "drop2" | "drop3" | "spread";

export interface ChordConfig {
  progressionId: string;
  chords: string[]; // e.g. ["Dm","Bb","F","C"]
  beatsPerChord: number; // default 4
  octave: number;
  voicing?: ChordVoicing;
}

export type DrumRow = "kick" | "snare" | "hihat" | "openhat" | "clap" | "perc" | "tom" | "shaker";
export interface DrumConfig {
  patternId: string;
  steps: number; // 8 | 12 | 16 | 32
  grid: Record<DrumRow, boolean[]>; // length === steps
  swing: number; // 0..0.6
  velocity: number; // 0..1 master humanize base
  accents?: boolean[] | undefined;
  /** Independent cycle lengths per drum row (e.g. { perc: 3, clap: 5, kick: 4 })
   * for continuous polymeter and polyrhythms without timing drift. */
  rowCycles?: Partial<Record<DrumRow, number>> | undefined;
  /** Independent subdivisions/steps-per-bar per drum row (e.g. { perc: 12, kick: 16 }). */
  rowSteps?: Partial<Record<DrumRow, number>> | undefined;
}

export type BassStyleId =
  | "root" | "octave" | "sustained" | "rhythmic" | "arp" | "sub" | "electronic" | "custom";

export interface BassConfig {
  styleId: BassStyleId;
  octave: number; // 0..3 (1 = low)
  volume: number; // 0..1
  pattern?: boolean[]; // optional 8/16-step rhythmic gate when style rhythmic/electronic/custom
}

export type InstrumentGroupId =
  | "piano" | "guitar" | "strings" | "synth" | "bass" | "drums"
  | "percussion" | "pads" | "atmosphere" | "brass" | "plucks" | "arps"
  | "winds";

export interface InstrumentSlot {
  id: string; // unique
  group: InstrumentGroupId;
  name: string;
  enabled: boolean;
  volume: number; // 0..1
  pan: number; // -1..1
  octave: number; // -2..2 offset
  role: "chords" | "melody" | "arp" | "pad" | "bass" | "lead" | "texture";
  style: string; // free-form style tag e.g. "soft", "bright"
  patternVariant: string; // e.g. "block", "broken", "arp-up"
  arpeggiator?: ArpeggiatorConfig | undefined;
}

export interface ArrangementSection {
  id: string;
  name: string; // INTRO, VERSE...
  bars: number;
  energy: number; // 1..10
  instruments: string[]; // instrument slot ids enabled in section; empty = all enabled
}

export interface ProjectMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface ProjectConfig {
  bpm: number;
  keyTonic: string; // "D"
  scale: ScaleKind; // "minor"
  timeSignature: TimeSignature;
  mood: string;
  energy: number; // 1..10
  dynamics: number; // 1..10
  /** Performance feel for playback/render: "off" | "subtle" | "natural" | "expressive".
   * Optional so v1–v3 projects load; normalize defaults to "subtle", which
   * reproduces the historical sound exactly. Never affects composition data. */
  humanize?: HumanizeLevel;
}

export interface OriginalityFlags {
  usesImportedRecording: boolean;
  usesCommercialSample: boolean;
  usesCopiedMelody: boolean;
  repeatedMelody: boolean;
  presetOnly: boolean;
  melodySeed: string;
  notes?: string;
}

export interface SonicProject {
  schemaVersion: number;
  meta: ProjectMeta;
  config: ProjectConfig;
  chords: ChordConfig;
  drums: DrumConfig;
  bass: BassConfig;
  melodyStyle: string;
  instruments: InstrumentSlot[];
  arrangement: ArrangementSection[];
  originality: OriginalityFlags;
  layers: LayerState;
  /** Deliberate saved snapshots ("Save Version"). Optional on stored data so
   * v1/v2 projects load; always present after normalizeProject. */
  versions?: ProjectVersion[];
  /** Master effects (reverb, delay, EQ) settings. Optional on stored data so
   * v1–v4 projects load; always present with safe neutral defaults after normalizeProject. */
  effects?: MasterFxConfig;
}

/** A deliberate snapshot of a project: full copy of the musical state (never
 * nested — snapshots carry no versions of their own), plus bookkeeping. */
export interface ProjectVersion {
  id: string;
  /** User label, e.g. "Bigger Chorus". Defaults to "Version N". */
  label: string;
  createdAt: string;
  /** Monotonic per project; never reused after deletes. */
  versionNumber: number;
  snapshot: ProjectSnapshot;
}

/** The musical state inside a version: a whole project minus its history. */
export type ProjectSnapshot = Omit<SonicProject, "versions">;

/** Bring any stored project (v1–v5) up to the current schema.
 * v1 projects predate layer toggles, so every layer defaults ON.
 * v1/v2 projects predate version history, so they start with no versions.
 * v1–v3 projects predate the feel preference, so it defaults to "subtle"
 * (the historical sound, bit for bit).
 * v1–v4 projects predate master effects, so they default bypassed (identical sound). */
export function normalizeProject(p: SonicProject): SonicProject {
  const rawVersions: unknown[] = Array.isArray(p.versions) ? p.versions : [];
  const versions: ProjectVersion[] = rawVersions
    .filter((v): v is Record<string, unknown> => isRecord(v))
    .map((rec) => {
      let snapshot = rec["snapshot"];
      if (isRecord(snapshot)) {
        const snap: Record<string, unknown> = { ...snapshot };
        delete snap["versions"];
        snapshot = snap;
      }
      return {
        id: typeof rec["id"] === "string" ? rec["id"] : uid("ver"),
        createdAt: typeof rec["createdAt"] === "string" ? rec["createdAt"] : new Date().toISOString(),
        label: typeof rec["label"] === "string" ? rec["label"] : "Snapshot",
        versionNumber: typeof rec["versionNumber"] === "number" ? rec["versionNumber"] : 1,
        snapshot: snapshot as ProjectSnapshot,
      };
    })
    .slice(-MAX_VERSIONS);
  return {
    ...p,
    schemaVersion: SCHEMA_VERSION,
    layers: getLayers(p),
    versions,
    config: { ...p.config, humanize: normalizeLevel(p.config?.humanize) },
    effects: normalizeMasterFx(p.effects),
    chords: {
      ...p.chords,
      voicing: (p.chords?.voicing && CHORD_VOICINGS.includes(p.chords.voicing) ? p.chords.voicing : "root") as ChordVoicing,
    },
    drums: {
      ...p.drums,
      rowCycles: p.drums?.rowCycles ? { ...p.drums.rowCycles } : undefined,
      rowSteps: p.drums?.rowSteps ? { ...p.drums.rowSteps } : undefined,
    },
  };
}

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function defaultDrumGrid(steps: number): Record<DrumRow, boolean[]> {
  const blank = () => Array.from({ length: steps }, () => false);
  return {
    kick: blank(), snare: blank(), hihat: blank(), openhat: blank(),
    clap: blank(), perc: blank(), tom: blank(), shaker: blank(),
  };
}

export function defaultDrums(): DrumConfig {
  const steps = 16;
  const grid = defaultDrumGrid(steps);
  // four-on-floor-ish pop default
  [0, 4, 8, 12].forEach((i) => (grid.kick[i] = true));
  [4, 12].forEach((i) => (grid.snare[i] = true));
  for (let i = 0; i < 16; i += 2) grid.hihat[i] = true;
  grid.openhat[14] = true;
  return { patternId: "pop-four-floor", steps, grid, swing: 0, velocity: 0.9 };
}

export function defaultInstruments(): InstrumentSlot[] {
  return [
    { id: uid("inst"), group: "piano", name: "Grand Piano", enabled: true, volume: 0.8, pan: 0, octave: 0, role: "chords", style: "soft", patternVariant: "block" },
    { id: uid("inst"), group: "pads", name: "Warm Pad", enabled: true, volume: 0.55, pan: 0, octave: 0, role: "pad", style: "warm", patternVariant: "sustain" },
    { id: uid("inst"), group: "strings", name: "String Ensemble", enabled: false, volume: 0.6, pan: 0, octave: 0, role: "pad", style: "legato", patternVariant: "sustain" },
    { id: uid("inst"), group: "synth", name: "Analog Synth", enabled: false, volume: 0.65, pan: 0, octave: 0, role: "arp", style: "bright", patternVariant: "arp-up" },
    { id: uid("inst"), group: "plucks", name: "Night Pluck", enabled: true, volume: 0.6, pan: 0.1, octave: 1, role: "melody", style: "pluck", patternVariant: "melody" },
    { id: uid("inst"), group: "bass", name: "Sub Bass", enabled: true, volume: 0.85, pan: 0, octave: 0, role: "bass", style: "sub", patternVariant: "root" },
  ];
}

export function defaultArrangement(): ArrangementSection[] {
  const mk = (name: string, bars: number, energy: number): ArrangementSection => ({
    id: uid("sec"), name, bars, energy, instruments: [],
  });
  return [
    mk("INTRO", 4, 3),
    mk("VERSE", 8, 5),
    mk("PRE-CHORUS", 4, 6),
    mk("CHORUS", 8, 8),
    mk("VERSE", 8, 5),
    mk("CHORUS", 8, 8),
    mk("BRIDGE", 4, 6),
    mk("FINAL CHORUS", 8, 9),
    mk("OUTRO", 4, 3),
  ];
}

export function createProject(name = "Untitled Blueprint", seed?: Partial<SonicProject>): SonicProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      id: uid("proj"),
      name,
      createdAt: now,
      updatedAt: now,
      version: 1,
    },
    config: {
      bpm: 100, keyTonic: "D", scale: "minor",
      timeSignature: "4/4", mood: "Emotional", energy: 6, dynamics: 6,
      humanize: "subtle",
      ...(seed?.config ?? {}),
    },
    chords: {
      progressionId: "emotional-i-vi-iii-vii",
      chords: ["Dm", "Bb", "F", "C"],
      beatsPerChord: 4,
      octave: 3,
      ...(seed?.chords ?? {}),
    },
    drums: seed?.drums ?? defaultDrums(),
    bass: { styleId: "root", octave: 1, volume: 0.85, ...(seed?.bass ?? {}) },
    melodyStyle: seed?.melodyStyle ?? "gentle",
    instruments: seed?.instruments ?? defaultInstruments(),
    arrangement: seed?.arrangement ?? defaultArrangement(),
    layers: { ...defaultLayers(), ...(seed?.layers ?? {}) },
    versions: seed?.versions ? [...seed.versions] : [],
    effects: seed?.effects ? normalizeMasterFx(seed.effects) : defaultMasterFx(),
    originality: {
      usesImportedRecording: false,
      usesCommercialSample: false,
      usesCopiedMelody: false,
      repeatedMelody: false,
      presetOnly: true,
      melodySeed: Math.random().toString(36).slice(2, 10),
      ...(seed?.originality ?? {}),
    },
  };
}

/** Beats per bar for time signature. */
export function beatsPerBar(ts: TimeSignature): number {
  switch (ts) {
    case "4/4": return 4;
    case "3/4": return 3;
    case "6/8": return 6; // eighth-note beats; scheduler treats as 6 eighth = 2 dotted-quarter; keep 6 steps of 0.5 quarter
    case "12/8": return 12;
    default: return 4;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Bounded string: present, a string, non-empty, and not absurdly large.
 * Project files come from anywhere on the internet; a 10 MB chord symbol
 * must never reach the renderers. */
function isSaneString(v: unknown, maxLen: number, allowEmpty = false): v is string {
  return typeof v === "string" && (allowEmpty || v.length > 0) && v.length <= maxLen;
}

const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "12/8"];
const SCALES = [
  "major",
  "minor",
  "dorian",
  "mixolydian",
  "phrygian",
  "lydian",
  "harmonicMinor",
  "pentMajor",
  "pentMinor",
  "blues",
];
const CHORD_VOICINGS = ["root", "firstInversion", "secondInversion", "thirdInversion", "open", "drop2", "drop3", "spread"];
const HUMANIZE_LEVELS = ["off", "subtle", "natural", "expressive"];
const BASS_STYLES = ["root", "octave", "sustained", "rhythmic", "arp", "sub", "electronic", "custom"];
const INSTRUMENT_GROUPS = [
  "piano", "guitar", "strings", "synth", "bass", "drums",
  "percussion", "pads", "atmosphere", "brass", "plucks", "arps", "winds",
];
const INSTRUMENT_ROLES = ["chords", "melody", "arp", "pad", "bass", "lead", "texture"];
const DRUM_ROWS = ["kick", "snare", "hihat", "openhat", "clap", "perc", "tom", "shaker"];

function isValidConfig(config: unknown): boolean {
  if (!isRecord(config)) return false;
  // BPM: any finite number loads (the engine clamps to the 30–240 musical
  // range); NaN/Infinity/strings must never reach timing math.
  if (!isFiniteNumber(config["bpm"])) return false;
  if (!isSaneString(config["keyTonic"], 8)) return false;
  if (typeof config["scale"] !== "string" || !SCALES.includes(config["scale"])) return false;
  if (typeof config["timeSignature"] !== "string" || !TIME_SIGNATURES.includes(config["timeSignature"])) return false;
  if (!isSaneString(config["mood"], 128)) return false;
  if (!isFiniteNumber(config["energy"]) || (config["energy"] as number) < 1 || (config["energy"] as number) > 10) return false;
  if (!isFiniteNumber(config["dynamics"]) || (config["dynamics"] as number) < 1 || (config["dynamics"] as number) > 10) return false;
  // Feel preference is optional (v1–v3 predate it) but must be a known level
  // when present — unknown levels are rejected rather than silently remapped.
  if (config["humanize"] !== undefined && (typeof config["humanize"] !== "string" || !HUMANIZE_LEVELS.includes(config["humanize"] as string))) {
    return false;
  }
  return true;
}

function isValidDrums(drums: unknown): boolean {
  if (!isRecord(drums)) return false;
  if (
    !isFiniteNumber(drums["steps"]) ||
    (drums["steps"] as number) < 1 ||
    (drums["steps"] as number) > 64
  ) {
    return false;
  }
  if (!isSaneString(drums["patternId"], 256)) return false;
  if (drums["swing"] !== undefined && !isFiniteNumber(drums["swing"])) return false;
  if (drums["velocity"] !== undefined && !isFiniteNumber(drums["velocity"])) return false;
  const grid = drums["grid"];
  if (grid !== undefined) {
    if (!isRecord(grid)) return false;
    // Known rows, when present, must be boolean arrays of sane length.
    // Unknown extra rows are ignored (forward compatibility).
    for (const row of DRUM_ROWS) {
      const col = (grid as Record<string, unknown>)[row];
      if (col === undefined) continue;
      if (!Array.isArray(col) || col.length === 0 || col.length > 256) return false;
      if (col.some((v) => typeof v !== "boolean")) return false;
    }
  }
  if (drums["accents"] !== undefined) {
    if (!Array.isArray(drums["accents"]) || (drums["accents"] as unknown[]).length > 256) return false;
    if ((drums["accents"] as unknown[]).some((v) => typeof v !== "boolean")) return false;
  }
  if (drums["rowCycles"] !== undefined) {
    if (!isRecord(drums["rowCycles"])) return false;
    for (const [k, v] of Object.entries(drums["rowCycles"] as Record<string, unknown>)) {
      if (!DRUM_ROWS.includes(k as DrumRow)) continue;
      if (!isFiniteNumber(v) || (v as number) < 1 || (v as number) > 64) return false;
    }
  }
  if (drums["rowSteps"] !== undefined) {
    if (!isRecord(drums["rowSteps"])) return false;
    for (const [k, v] of Object.entries(drums["rowSteps"] as Record<string, unknown>)) {
      if (!DRUM_ROWS.includes(k as DrumRow)) continue;
      if (!isFiniteNumber(v) || (v as number) < 1 || (v as number) > 64) return false;
    }
  }
  return true;
}

function isValidBass(bass: unknown): boolean {
  if (!isRecord(bass)) return false;
  if (typeof bass["styleId"] !== "string" || !BASS_STYLES.includes(bass["styleId"] as string)) return false;
  if (!isFiniteNumber(bass["octave"])) return false;
  if (!isFiniteNumber(bass["volume"])) return false;
  if (bass["pattern"] !== undefined) {
    if (!Array.isArray(bass["pattern"]) || (bass["pattern"] as unknown[]).length > 256) return false;
    if ((bass["pattern"] as unknown[]).some((v) => typeof v !== "boolean")) return false;
  }
  return true;
}

function isValidInstrument(entry: unknown): boolean {
  if (!isRecord(entry)) return false;
  if (!isSaneString(entry["id"], 128)) return false;
  if (typeof entry["group"] !== "string" || !INSTRUMENT_GROUPS.includes(entry["group"])) return false;
  if (!isSaneString(entry["name"], 256)) return false;
  if (typeof entry["enabled"] !== "boolean") return false;
  if (!isFiniteNumber(entry["volume"]) || (entry["volume"] as number) < 0 || (entry["volume"] as number) > 1) return false;
  if (!isFiniteNumber(entry["pan"]) || (entry["pan"] as number) < -1 || (entry["pan"] as number) > 1) return false;
  if (!isFiniteNumber(entry["octave"])) return false;
  if (typeof entry["role"] !== "string" || !INSTRUMENT_ROLES.includes(entry["role"])) return false;
  if (!isSaneString(entry["style"], 128)) return false;
  if (!isSaneString(entry["patternVariant"], 128)) return false;
  if (entry["arpeggiator"] !== undefined) {
    if (!isRecord(entry["arpeggiator"])) return false;
    const arp = entry["arpeggiator"];
    if (arp["enabled"] !== undefined && typeof arp["enabled"] !== "boolean") return false;
    if (
      arp["pattern"] !== undefined &&
      (typeof arp["pattern"] !== "string" ||
        !["up", "down", "upDown", "random", "asPlayed"].includes(arp["pattern"] as string))
    )
      return false;
    if (
      arp["rate"] !== undefined &&
      (typeof arp["rate"] !== "string" ||
        !["1/4", "1/8", "1/16", "1/8t", "1/16t"].includes(arp["rate"] as string))
    )
      return false;
    if (
      arp["octaves"] !== undefined &&
      (!isFiniteNumber(arp["octaves"]) || (arp["octaves"] as number) < 1 || (arp["octaves"] as number) > 3)
    )
      return false;
    if (
      arp["gate"] !== undefined &&
      (!isFiniteNumber(arp["gate"]) || (arp["gate"] as number) < 0.1 || (arp["gate"] as number) > 1.0)
    )
      return false;
  }
  return true;
}

function isValidSection(sec: unknown): boolean {
  if (!isRecord(sec)) return false;
  const secRec = sec as Record<string, unknown>;
  if (!isSaneString(secRec["id"], 128)) return false;
  // Name and bars are rendered unconditionally by the timeline UI.
  if (!isSaneString(secRec["name"], 256)) return false;
  const bars = secRec["bars"];
  if (!isFiniteNumber(bars) || (bars as number) < 1 || (bars as number) > 64) {
    return false;
  }
  if (secRec["energy"] !== undefined) {
    if (!isFiniteNumber(secRec["energy"]) || (secRec["energy"] as number) < 1 || (secRec["energy"] as number) > 10) return false;
  }
  if (secRec["instruments"] !== undefined) {
    if (!Array.isArray(secRec["instruments"]) || (secRec["instruments"] as unknown[]).length > 512) return false;
    if ((secRec["instruments"] as unknown[]).some((v) => typeof v !== "string" || (v as string).length > 128)) return false;
  }
  return true;
}

function isValidLayers(layers: unknown): boolean {
  if (!isRecord(layers) || Array.isArray(layers)) return false;
  for (const id of ["chords", "drums", "bass", "melody"]) {
    const v = (layers as Record<string, unknown>)[id];
    if (v !== undefined && typeof v !== "boolean") return false;
  }
  return true;
}

function isValidOriginality(originality: unknown): boolean {
  if (!isRecord(originality)) return false;
  for (const k of ["usesImportedRecording", "usesCommercialSample", "usesCopiedMelody", "repeatedMelody", "presetOnly"]) {
    const v = (originality as Record<string, unknown>)[k];
    if (v !== undefined && typeof v !== "boolean") return false;
  }
  if (
    originality["melodySeed"] !== undefined &&
    (typeof originality["melodySeed"] !== "string" ||
      (originality["melodySeed"] as string).length > 512)
  ) {
    return false;
  }
  if (originality["notes"] !== undefined && !isSaneString(originality["notes"], 2000, true)) return false;
  return true;
}

function isValidEffects(fx: unknown): boolean {
  if (!isRecord(fx)) return false;
  const rev = fx["reverb"];
  if (rev !== undefined) {
    if (!isRecord(rev)) return false;
    if (rev["enabled"] !== undefined && typeof rev["enabled"] !== "boolean") return false;
    if (rev["decay"] !== undefined && (!isFiniteNumber(rev["decay"]) || (rev["decay"] as number) < 0.1 || (rev["decay"] as number) > 10)) return false;
    if (rev["mix"] !== undefined && (!isFiniteNumber(rev["mix"]) || (rev["mix"] as number) < 0 || (rev["mix"] as number) > 1)) return false;
    if (rev["tone"] !== undefined && (!isFiniteNumber(rev["tone"]) || (rev["tone"] as number) < 100 || (rev["tone"] as number) > 20000)) return false;
  }
  const del = fx["delay"];
  if (del !== undefined) {
    if (!isRecord(del)) return false;
    if (del["enabled"] !== undefined && typeof del["enabled"] !== "boolean") return false;
    if (del["time"] !== undefined && (!isFiniteNumber(del["time"]) || (del["time"] as number) < 0.01 || (del["time"] as number) > 5)) return false;
    if (del["feedback"] !== undefined && (!isFiniteNumber(del["feedback"]) || (del["feedback"] as number) < 0 || (del["feedback"] as number) > 1)) return false;
    if (del["mix"] !== undefined && (!isFiniteNumber(del["mix"]) || (del["mix"] as number) < 0 || (del["mix"] as number) > 1)) return false;
  }
  const eq = fx["eq"];
  if (eq !== undefined) {
    if (!isRecord(eq)) return false;
    if (eq["enabled"] !== undefined && typeof eq["enabled"] !== "boolean") return false;
    if (eq["lowGain"] !== undefined && (!isFiniteNumber(eq["lowGain"]) || Math.abs(eq["lowGain"] as number) > 24)) return false;
    if (eq["midGain"] !== undefined && (!isFiniteNumber(eq["midGain"]) || Math.abs(eq["midGain"] as number) > 24)) return false;
    if (eq["highGain"] !== undefined && (!isFiniteNumber(eq["highGain"]) || Math.abs(eq["highGain"] as number) > 24)) return false;
  }
  const mod = fx["modulation"];
  if (mod !== undefined) {
    if (!isRecord(mod)) return false;
    if (mod["enabled"] !== undefined && typeof mod["enabled"] !== "boolean") return false;
    if (mod["type"] !== undefined && (typeof mod["type"] !== "string" || !["chorus", "flanger"].includes(mod["type"] as string))) return false;
    if (mod["rate"] !== undefined && (!isFiniteNumber(mod["rate"]) || (mod["rate"] as number) < 0.05 || (mod["rate"] as number) > 20)) return false;
    if (mod["depth"] !== undefined && (!isFiniteNumber(mod["depth"]) || (mod["depth"] as number) < 0 || (mod["depth"] as number) > 1)) return false;
    if (mod["feedback"] !== undefined && (!isFiniteNumber(mod["feedback"]) || (mod["feedback"] as number) < 0 || (mod["feedback"] as number) > 1)) return false;
    if (mod["mix"] !== undefined && (!isFiniteNumber(mod["mix"]) || (mod["mix"] as number) < 0 || (mod["mix"] as number) > 1)) return false;
  }
  const comp = fx["compressor"];
  if (comp !== undefined) {
    if (!isRecord(comp)) return false;
    if (comp["enabled"] !== undefined && typeof comp["enabled"] !== "boolean") return false;
    if (comp["threshold"] !== undefined && (!isFiniteNumber(comp["threshold"]) || (comp["threshold"] as number) < -100 || (comp["threshold"] as number) > 10)) return false;
    if (comp["knee"] !== undefined && (!isFiniteNumber(comp["knee"]) || (comp["knee"] as number) < 0 || (comp["knee"] as number) > 50)) return false;
    if (comp["ratio"] !== undefined && (!isFiniteNumber(comp["ratio"]) || (comp["ratio"] as number) < 1 || (comp["ratio"] as number) > 50)) return false;
    if (comp["attack"] !== undefined && (!isFiniteNumber(comp["attack"]) || (comp["attack"] as number) < 0.0001 || (comp["attack"] as number) > 1)) return false;
    if (comp["release"] !== undefined && (!isFiniteNumber(comp["release"]) || (comp["release"] as number) < 0.01 || (comp["release"] as number) > 5)) return false;
    if (comp["makeupGain"] !== undefined && (!isFiniteNumber(comp["makeupGain"]) || (comp["makeupGain"] as number) < 0 || (comp["makeupGain"] as number) > 36)) return false;
    if (comp["autoMakeup"] !== undefined && typeof comp["autoMakeup"] !== "boolean") return false;
  }
  return true;
}

export function validateProject(p: unknown): p is SonicProject {
  return validateProjectInner(p, 0);
}

function validateVersions(v: unknown, depth: number): v is ProjectVersion[] {
  // History never nests: depth > 0 means a snapshot smuggled versions.
  if (depth > 0) return false;
  if (!Array.isArray(v) || v.length > 100) return false;
  return v.every((entry) => {
    if (!isRecord(entry)) return false;
    if (typeof entry["id"] !== "string" || entry["id"].length === 0) return false;
    if (typeof entry["label"] !== "string") return false;
    if (typeof entry["createdAt"] !== "string") return false;
    if (!isFiniteNumber(entry["versionNumber"])) return false;
    const snap = entry["snapshot"];
    if (!isRecord(snap) || "versions" in snap) return false;
    return validateProjectInner(snap, depth + 1);
  });
}

function validateProjectInner(p: unknown, depth: number): p is SonicProject {
  if (!isRecord(p)) return false;
  // v1 projects predate layer toggles, v1–v3 predate version history and the
  // feel preference, v1–v4 predate master effects; all four are migrated on load.
  if (
    p["schemaVersion"] !== 1 &&
    p["schemaVersion"] !== 2 &&
    p["schemaVersion"] !== 3 &&
    p["schemaVersion"] !== 4 &&
    p["schemaVersion"] !== SCHEMA_VERSION
  ) {
    return false;
  }
  // typeof null === "object", so null sections must be rejected explicitly.
  const meta = p["meta"];
  const config = p["config"];
  if (!isRecord(meta) || !isSaneString(meta["id"], 128)) return false;
  if (!isSaneString(meta["name"], 512, true)) return false;
  if (!isValidConfig(config)) return false;
  // Layer flags are optional (v1 predates them) but present flags must be
  // booleans — a "yes" string must not silently mean ON downstream.
  if (p["layers"] !== undefined && !isValidLayers(p["layers"])) {
    return false;
  }

  // Master effects are optional (v1–v4 predate them) but must be well-formed when present.
  if (p["effects"] !== undefined && !isValidEffects(p["effects"])) {
    return false;
  }

  // Version history is optional (v1/v2 predate it) but must be well-formed.
  if (p["versions"] !== undefined && !validateVersions(p["versions"], depth)) {
    return false;
  }

  // Structural sections must exist with sane bounds. Anything absurd
  // (gigantic arrays, unbounded loops) is rejected rather than rendered,
  // since project files can come from anywhere on the internet.
  const chords = p["chords"];
  if (!isRecord(chords)) return false;
  // At least one chord: UI components index into this array.
  // Every entry must be a sane string: symbols call string methods at render.
  const chordList = chords["chords"];
  if (!Array.isArray(chordList) || chordList.length < 1 || chordList.length > 128) {
    return false;
  }
  if (chordList.some((c) => !isSaneString(c, 32))) return false;
  if (
    !isFiniteNumber(chords["beatsPerChord"]) ||
    (chords["beatsPerChord"] as number) < 1 ||
    (chords["beatsPerChord"] as number) > 64
  ) {
    return false;
  }
  if (!isSaneString(chords["progressionId"], 256)) return false;
  if (!isFiniteNumber(chords["octave"])) return false;
  if (chords["voicing"] !== undefined && (typeof chords["voicing"] !== "string" || !CHORD_VOICINGS.includes(chords["voicing"] as string))) {
    return false;
  }

  if (!isValidDrums(p["drums"])) return false;

  if (!isValidBass(p["bass"])) return false;

  if (p["melodyStyle"] !== undefined && !isSaneString(p["melodyStyle"], 128)) return false;

  const instruments = p["instruments"];
  if (!Array.isArray(instruments) || instruments.length > 512) return false;
  if (instruments.some((entry) => !isValidInstrument(entry))) return false;

  const arrangement = p["arrangement"];
  if (!Array.isArray(arrangement) || arrangement.length > 512) return false;
  for (const sec of arrangement) {
    if (!isValidSection(sec)) return false;
  }

  if (!isValidOriginality(p["originality"])) return false;
  return true;
}

export function touchProject(p: SonicProject): SonicProject {
  return {
    ...p,
    meta: { ...p.meta, updatedAt: new Date().toISOString(), version: p.meta.version + 1 },
  };
}

// ── Version history ("Save Version") ──
// Pure helpers: snapshots are deep full copies of the musical state. Creating
// a version never alters the live project except for appending history.

function versionsOf(p: SonicProject): ProjectVersion[] {
  return Array.isArray(p.versions) ? p.versions : [];
}

/** Next version number: max existing + 1, so numbers are never reused. */
export function nextVersionNumber(p: SonicProject): number {
  let max = 0;
  for (const v of versionsOf(p)) {
    if (Number.isFinite(v.versionNumber)) max = Math.max(max, v.versionNumber);
  }
  return max + 1;
}

/** Deep snapshot of the musical state (history excluded — never nested). */
export function snapshotProject(p: SonicProject): ProjectSnapshot {
  const clone = structuredClone(p);
  delete clone.versions;
  return clone;
}

/** Append a version. The live musical state is returned untouched. */
export function createVersion(p: SonicProject, label?: string): SonicProject {
  const n = nextVersionNumber(p);
  const entry: ProjectVersion = {
    id: uid("ver"),
    label: label?.trim() || `Version ${n}`,
    createdAt: new Date().toISOString(),
    versionNumber: n,
    snapshot: snapshotProject(p),
  };
  return { ...p, versions: [...versionsOf(p), entry].slice(-MAX_VERSIONS) };
}

/** Restore a version into the live project. Keeps the project's identity
 * (meta) and its history; only the musical state comes from the snapshot.
 * Returns null when the id is unknown. */
export function restoreVersion(p: SonicProject, versionId: string): SonicProject | null {
  const found = versionsOf(p).find((v) => v.id === versionId);
  if (!found || !isRecord(found.snapshot)) return null;
  const musical = structuredClone(found.snapshot) as ProjectSnapshot;
  delete (musical as Partial<SonicProject>).versions;
  return { ...musical, meta: { ...p.meta }, versions: versionsOf(p) };
}

/** Delete a version by id. Unknown ids leave the project unchanged. */
export function deleteVersion(p: SonicProject, versionId: string): SonicProject {
  const next = versionsOf(p).filter((v) => v.id !== versionId);
  if (next.length === versionsOf(p).length) return p;
  return { ...p, versions: next };
}
