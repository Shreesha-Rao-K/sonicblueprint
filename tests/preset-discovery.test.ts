// Unit tests: preset discovery filters (pure logic, UI-independent).
import { suite, test, eq, ok } from "./helpers";
import { CHORD_PROGRESSIONS } from "@/data/chords";
import { DRUM_PRESETS } from "@/data/drums";
import { INSTRUMENT_DEFS, QUICK_STARTS } from "@/data/styles";
import {
  filterChordProgressions,
  filterDrumPresets,
  filterInstruments,
  filterQuickStarts,
  matchesQuery,
} from "@/lib/preset-filters";

suite("preset search");

test("empty query matches everything", () => {
  eq(filterChordProgressions(CHORD_PROGRESSIONS, {}).length, CHORD_PROGRESSIONS.length);
  eq(filterDrumPresets(DRUM_PRESETS, {}).length, DRUM_PRESETS.length);
  eq(filterQuickStarts(QUICK_STARTS, {}).length, QUICK_STARTS.length);
  eq(filterInstruments(INSTRUMENT_DEFS, {}).length, INSTRUMENT_DEFS.length);
});

test("search is case-insensitive across name and description", () => {
  ok(filterChordProgressions(CHORD_PROGRESSIONS, { q: "anthem" }).length >= 1, "chord hit");
  ok(filterDrumPresets(DRUM_PRESETS, { q: "TRAP" }).length >= 1, "drum hit");
  ok(filterQuickStarts(QUICK_STARTS, { q: "cinematic" }).length >= 1, "starter hit");
  ok(filterInstruments(INSTRUMENT_DEFS, { q: "piano" }).length >= 1, "sound hit");
  eq(filterChordProgressions(CHORD_PROGRESSIONS, { q: "zzz-no-such-preset" }).length, 0);
});

test("matchesQuery trims and ignores case", () => {
  ok(matchesQuery("Hello World", "  hello  "), "trims");
  ok(!matchesQuery("Hello", "bye"), "miss");
  ok(matchesQuery("anything", ""), "empty");
});

suite("preset facet filters");

test("chord genre + mood narrow results", () => {
  const cinematic = filterChordProgressions(CHORD_PROGRESSIONS, { category: "cinematic" });
  ok(cinematic.length > 0 && cinematic.length < CHORD_PROGRESSIONS.length, `cinematic=${cinematic.length}`);
  for (const c of cinematic) eq(c.category, "cinematic");
  const dark = filterChordProgressions(CHORD_PROGRESSIONS, { mood: "Dark" });
  ok(dark.length > 0, "dark mood hits");
  for (const c of dark) ok(c.moodTags.includes("Dark"), c.id);
});

test("chord energy bands partition the library", () => {
  const seen = new Set<string>();
  for (const band of ["low", "mid", "high"]) {
    for (const c of filterChordProgressions(CHORD_PROGRESSIONS, { energy: band })) seen.add(c.id);
  }
  eq(seen.size, CHORD_PROGRESSIONS.length);
});

test("chord difficulty filter is exact", () => {
  for (const d of ["easy", "medium", "advanced"]) {
    const got = filterChordProgressions(CHORD_PROGRESSIONS, { difficulty: d });
    ok(got.length > 0, d);
    for (const c of got) eq(c.difficulty, d);
  }
});

test("drum tempo filter uses range overlap", () => {
  const slow = filterDrumPresets(DRUM_PRESETS, { tempo: "slow" });
  ok(slow.length > 0, "slow drums exist");
  for (const d of slow) ok(d.bpmSuggestion[0] <= 89, `${d.id} overlaps slow`);
  const fast = filterDrumPresets(DRUM_PRESETS, { tempo: "fast" });
  for (const d of fast) ok(d.bpmSuggestion[1] >= 116, `${d.id} overlaps fast`);
});

test("drum category filter is exact", () => {
  const got = filterDrumPresets(DRUM_PRESETS, { category: "Rock" });
  ok(got.length > 0, "rock drums exist");
  for (const d of got) eq(d.category, "Rock");
});

test("quick start mood + energy + tempo combine", () => {
  const all = filterQuickStarts(QUICK_STARTS, {});
  eq(all.length, QUICK_STARTS.length);
  const slow = filterQuickStarts(QUICK_STARTS, { tempo: "slow" });
  ok(slow.length > 0 && slow.length < QUICK_STARTS.length, `slow=${slow.length}`);
  for (const t of slow) ok(t.bpm <= 89, t.id);
  const high = filterQuickStarts(QUICK_STARTS, { energy: "high" });
  for (const t of high) ok(t.energy >= 7, t.id);
});

test("instrument group + role filters combine", () => {
  const pianos = filterInstruments(INSTRUMENT_DEFS, { group: "piano" });
  ok(pianos.length >= 2, "pianos exist");
  const bassRole = filterInstruments(INSTRUMENT_DEFS, { role: "bass" });
  ok(bassRole.length >= 2, "bass role exists");
  const both = filterInstruments(INSTRUMENT_DEFS, { group: "bass", role: "bass" });
  eq(both.length, bassRole.filter((d) => d.group === "bass").length);
});

suite("preset discovery edge cases");

test("multiple simultaneous filters intersect", () => {
  const got = filterChordProgressions(CHORD_PROGRESSIONS, {
    q: "a",
    category: "dark",
    mood: "Dark",
    energy: "high",
    difficulty: "easy",
  });
  for (const c of got) {
    eq(c.category, "dark");
    ok(c.moodTags.includes("Dark"), c.id);
    ok(c.energy >= 7, c.id);
    eq(c.difficulty, "easy");
  }
  // clearing every filter restores the full library
  eq(filterChordProgressions(CHORD_PROGRESSIONS, { q: "", category: "all", mood: "all", energy: "all", difficulty: "all" }).length, CHORD_PROGRESSIONS.length);
  eq(filterDrumPresets(DRUM_PRESETS, { q: "", category: "all", tempo: "all" }).length, DRUM_PRESETS.length);
  eq(filterQuickStarts(QUICK_STARTS, { q: "", mood: "all", energy: "all", tempo: "all" }).length, QUICK_STARTS.length);
  eq(filterInstruments(INSTRUMENT_DEFS, { q: "", group: "all", role: "all" }).length, INSTRUMENT_DEFS.length);
});

test("impossible combination yields no results", () => {
  eq(filterChordProgressions(CHORD_PROGRESSIONS, { q: "zzz-no-such-preset", category: "dark" }).length, 0);
  eq(filterDrumPresets(DRUM_PRESETS, { q: "zzz-no-such-preset" }).length, 0);
  eq(filterQuickStarts(QUICK_STARTS, { q: "zzz-no-such-preset" }).length, 0);
  eq(filterInstruments(INSTRUMENT_DEFS, { q: "zzz-no-such-preset" }).length, 0);
});

test("presets with missing optional metadata never crash", () => {
  const partialChord = [{ id: "x", name: "Partial", category: "dark", roman: "", chordsInC: ["Am"], description: "" }] as never;
  eq(filterChordProgressions(partialChord, {}).length, 1);
  eq(filterChordProgressions(partialChord, { mood: "Dark" }).length, 0);
  eq(filterChordProgressions(partialChord, { energy: "high" }).length, 0);
  const partialDrum = [{ id: "y", name: "Partial", category: "Rock", steps: 16, description: "" }] as never;
  eq(filterDrumPresets(partialDrum, {}).length, 1);
  eq(filterDrumPresets(partialDrum, { tempo: "slow" }).length, 0);
  const partialQs = [{ id: "z", title: "Partial", tagline: "", mood: "Dark" }] as never;
  eq(filterQuickStarts(partialQs, {}).length, 1);
  eq(filterQuickStarts(partialQs, { tempo: "slow" }).length, 0);
  eq(filterQuickStarts(partialQs, { energy: "high" }).length, 0);
});
