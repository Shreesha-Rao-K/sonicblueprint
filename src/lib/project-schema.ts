// ── Project schema v1: versioned JSON, defaults, validation ──

export const SCHEMA_VERSION = 2;

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
export type ScaleKind = "major" | "minor";

export interface ChordConfig {
  progressionId: string;
  chords: string[]; // e.g. ["Dm","Bb","F","C"]
  beatsPerChord: number; // default 4
  octave: number;
}

export type DrumRow = "kick" | "snare" | "hihat" | "openhat" | "clap" | "perc" | "tom" | "shaker";
export interface DrumConfig {
  patternId: string;
  steps: number; // 8 | 12 | 16 | 32
  grid: Record<DrumRow, boolean[]>; // length === steps
  swing: number; // 0..0.6
  velocity: number; // 0..1 master humanize base
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
  | "percussion" | "pads" | "atmosphere" | "brass" | "plucks" | "arps";

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
}

/** Bring any stored project (v1 or v2) up to the current schema.
 * v1 projects predate layer toggles, so every layer defaults ON. */
export function normalizeProject(p: SonicProject): SonicProject {
  return {
    ...p,
    schemaVersion: SCHEMA_VERSION,
    layers: getLayers(p),
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
  return typeof v === "object" && v !== null;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function validateProject(p: unknown): p is SonicProject {
  if (!isRecord(p)) return false;
  // v1 projects predate layer toggles and are migrated on load.
  if (p["schemaVersion"] !== 1 && p["schemaVersion"] !== SCHEMA_VERSION) return false;
  // typeof null === "object", so null sections must be rejected explicitly.
  const meta = p["meta"];
  const config = p["config"];
  if (!isRecord(meta) || typeof meta["id"] !== "string") return false;
  if (typeof meta["name"] !== "string") return false;
  if (!isRecord(config)) return false;
  // Layer flags are optional (v1 predates them) but must be an object when present.
  if (p["layers"] !== undefined && (!isRecord(p["layers"]) || Array.isArray(p["layers"]))) {
    return false;
  }

  // Structural sections must exist with sane bounds. Anything absurd
  // (gigantic arrays, unbounded loops) is rejected rather than rendered,
  // since project files can come from anywhere on the internet.
  const chords = p["chords"];
  if (!isRecord(chords)) return false;
  // At least one chord: UI components index into this array.
  // Every entry must be a string: chord symbols call string methods at render.
  const chordList = chords["chords"];
  if (!Array.isArray(chordList) || chordList.length < 1 || chordList.length > 128) {
    return false;
  }
  if (chordList.some((c) => typeof c !== "string")) return false;
  if (
    !isFiniteNumber(chords["beatsPerChord"]) ||
    (chords["beatsPerChord"] as number) < 1 ||
    (chords["beatsPerChord"] as number) > 64
  ) {
    return false;
  }
  if (typeof chords["progressionId"] !== "string") return false;

  const drums = p["drums"];
  if (!isRecord(drums)) return false;
  if (
    !isFiniteNumber(drums["steps"]) ||
    (drums["steps"] as number) < 1 ||
    (drums["steps"] as number) > 64
  ) {
    return false;
  }
  if (typeof drums["patternId"] !== "string") return false;
  if (drums["grid"] !== undefined && !isRecord(drums["grid"])) return false;

  if (!isRecord(p["bass"])) return false;

  const instruments = p["instruments"];
  if (!Array.isArray(instruments) || instruments.length > 512) return false;

  const arrangement = p["arrangement"];
  if (!Array.isArray(arrangement) || arrangement.length > 512) return false;
  for (const sec of arrangement) {
    if (!isRecord(sec)) return false;
    const secRec = sec as Record<string, unknown>;
    // Name and bars are rendered unconditionally by the timeline UI.
    if (typeof secRec["name"] !== "string") return false;
    const bars = secRec["bars"];
    if (!isFiniteNumber(bars) || (bars as number) < 1 || (bars as number) > 64) {
      return false;
    }
  }

  const originality = p["originality"];
  if (!isRecord(originality)) return false;
  if (
    originality["melodySeed"] !== undefined &&
    (typeof originality["melodySeed"] !== "string" ||
      (originality["melodySeed"] as string).length > 512)
  ) {
    return false;
  }
  return true;
}

export function touchProject(p: SonicProject): SonicProject {
  return {
    ...p,
    meta: { ...p.meta, updatedAt: new Date().toISOString(), version: p.meta.version + 1 },
  };
}
