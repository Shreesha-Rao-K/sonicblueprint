// Preset discovery filters — pure functions over existing preset metadata.
// No duplicated source of truth: every predicate reads the canonical data
// structures in src/data/*. A preset with missing optional metadata matches an
// inactive ("all"/empty) filter but never matches an active filter on the
// missing field.
import type { ChordProgressionPreset } from "@/data/chords";
import type { DrumPreset } from "@/data/drums";
import type { InstrumentDef, QuickStart } from "@/data/styles";

export type EnergyBandId = "low" | "mid" | "high";
export type TempoBandId = "slow" | "steady" | "fast";

export const ENERGY_BANDS: { id: EnergyBandId; label: string; min: number; max: number }[] = [
  { id: "low", label: "Calm (1–3)", min: 1, max: 3 },
  { id: "mid", label: "Balanced (4–6)", min: 4, max: 6 },
  { id: "high", label: "High (7–10)", min: 7, max: 10 },
];

export const TEMPO_BANDS: { id: TempoBandId; label: string; min: number; max: number }[] = [
  { id: "slow", label: "Slow (<90 BPM)", min: 0, max: 89 },
  { id: "steady", label: "Steady (90–115 BPM)", min: 90, max: 115 },
  { id: "fast", label: "Fast (116+ BPM)", min: 116, max: 999 },
];

function inRange(v: number | undefined, min: number, max: number): boolean {
  return typeof v === "number" && v >= min && v <= max;
}

/** Case-insensitive substring match; empty query matches everything. */
export function matchesQuery(haystack: string, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle === "") return true;
  return haystack.toLowerCase().includes(needle);
}

function bandOf<T extends { id: string; min: number; max: number }>(bands: T[], id: string): T | null {
  return bands.find((b) => b.id === id) ?? null;
}

export interface ChordFilter {
  q?: string;
  category?: string;
  mood?: string;
  energy?: string;
  difficulty?: string;
}

export function filterChordProgressions(
  list: ChordProgressionPreset[],
  f: ChordFilter
): ChordProgressionPreset[] {
  const q = f.q ?? "";
  const energyBand = bandOf(ENERGY_BANDS, f.energy ?? "all");
  return list.filter((c) => {
    if (f.category && f.category !== "all" && c.category !== f.category) return false;
    if (f.mood && f.mood !== "all" && !(c.moodTags ?? []).includes(f.mood)) return false;
    if (energyBand && !inRange(c.energy, energyBand.min, energyBand.max)) return false;
    if (f.difficulty && f.difficulty !== "all" && c.difficulty !== f.difficulty) return false;
    if (!matchesQuery(`${c.name} ${c.roman} ${c.chordsInC.join(" ")} ${c.description}`, q)) return false;
    return true;
  });
}

export interface DrumFilter {
  q?: string;
  category?: string;
  tempo?: string;
}

export function filterDrumPresets(list: DrumPreset[], f: DrumFilter): DrumPreset[] {
  const q = f.q ?? "";
  const tempoBand = bandOf(TEMPO_BANDS, f.tempo ?? "all");
  return list.filter((d) => {
    if (f.category && f.category !== "all" && d.category !== f.category) return false;
    if (tempoBand) {
      const r = d.bpmSuggestion;
      if (!r || r[1] < tempoBand.min || r[0] > tempoBand.max) return false;
    }
    if (!matchesQuery(`${d.name} ${d.category} ${d.description}`, q)) return false;
    return true;
  });
}

export interface QuickStartFilter {
  q?: string;
  mood?: string;
  energy?: string;
  tempo?: string;
}

export function filterQuickStarts(list: QuickStart[], f: QuickStartFilter): QuickStart[] {
  const q = f.q ?? "";
  const energyBand = bandOf(ENERGY_BANDS, f.energy ?? "all");
  const tempoBand = bandOf(TEMPO_BANDS, f.tempo ?? "all");
  return list.filter((t) => {
    if (f.mood && f.mood !== "all" && t.mood !== f.mood) return false;
    if (energyBand && !inRange(t.energy, energyBand.min, energyBand.max)) return false;
    if (tempoBand && !inRange(t.bpm, tempoBand.min, tempoBand.max)) return false;
    if (!matchesQuery(`${t.title} ${t.tagline} ${t.mood}`, q)) return false;
    return true;
  });
}

export interface InstrumentFilter {
  q?: string;
  group?: string;
  role?: string;
}

export function filterInstruments(list: InstrumentDef[], f: InstrumentFilter): InstrumentDef[] {
  const q = f.q ?? "";
  return list.filter((d) => {
    if (f.group && f.group !== "all" && d.group !== f.group) return false;
    if (f.role && f.role !== "all" && d.defaultRole !== f.role) return false;
    if (!matchesQuery(`${d.name} ${d.group} ${d.description}`, q)) return false;
    return true;
  });
}
