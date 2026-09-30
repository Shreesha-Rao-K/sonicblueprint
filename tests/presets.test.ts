// Unit tests: preset library integrity (data-driven, UI-independent).
import { suite, test, eq, ok } from "./helpers";
import {
  CHORD_PROGRESSIONS,
  PROGRESSION_CATEGORIES,
  resolvePresetChords,
} from "@/data/chords";
import { DRUM_CATEGORIES, DRUM_PRESETS } from "@/data/drums";
import {
  BASS_STYLES,
  INSTRUMENT_DEFS,
  MELODY_STYLES,
  MOODS,
  QUICK_STARTS,
} from "@/data/styles";
import { parseChord } from "@/lib/music-theory";

suite("chord progression library");

test("library is sizable with unique ids", () => {
  ok(CHORD_PROGRESSIONS.length >= 30, `count ${CHORD_PROGRESSIONS.length}`);
  eq(new Set(CHORD_PROGRESSIONS.map((p) => p.id)).size, CHORD_PROGRESSIONS.length);
});

test("every entry is well-formed", () => {
  const cats = new Set<string>(PROGRESSION_CATEGORIES);
  for (const p of CHORD_PROGRESSIONS) {
    ok(cats.has(p.category), `${p.id} category`);
    ok(p.chordsInC.length >= 2, `${p.id} has chords`);
    ok(p.bars >= 1, `${p.id} bars`);
    ok(p.energy >= 1 && p.energy <= 10, `${p.id} energy`);
    ok(["easy", "medium", "advanced"].includes(p.difficulty), `${p.id} difficulty`);
    ok(p.moodTags.length > 0, `${p.id} moods`);
    ok(p.roman.length > 0 && p.name.length > 0 && p.description.length > 0, `${p.id} text`);
    for (const c of p.chordsInC) {
      const parsed = parseChord(c);
      ok(parsed.rootPc >= 0 && parsed.rootPc <= 11, `${p.id}:${c} parses`);
    }
  }
});

test("presets resolve unchanged in their home key", () => {
  const p = CHORD_PROGRESSIONS.find((x) => x.id === "emotional-i-vi-iii-vii");
  ok(!!p, "reference preset exists");
  // library minor context is written around A minor
  eq(resolvePresetChords(p!, "A"), p!.chordsInC);
});

test("minor presets transpose by tonic distance", () => {
  const p = CHORD_PROGRESSIONS.find((x) => x.id === "emotional-i-vi-iii-vii")!;
  // A minor -> C minor is +3 semitones
  eq(resolvePresetChords(p, "C"), ["Cm", "Ab", "Eb", "Bb"]);
});

suite("drum pattern library");

test("patterns are sizable with unique ids", () => {
  ok(DRUM_PRESETS.length >= 15, `count ${DRUM_PRESETS.length}`);
  eq(new Set(DRUM_PRESETS.map((p) => p.id)).size, DRUM_PRESETS.length);
});

test("every built pattern matches its declared step count", () => {
  const cats = new Set<string>(DRUM_CATEGORIES);
  for (const p of DRUM_PRESETS) {
    ok(cats.has(p.category), `${p.id} category`);
    ok([8, 12, 16].includes(p.steps), `${p.id} steps=${p.steps}`);
    ok(p.bpmSuggestion[0] <= p.bpmSuggestion[1], `${p.id} tempo range`);
    const built = p.build();
    eq(built.steps, p.steps);
    eq(built.patternId, p.id);
    for (const row of Object.keys(built.grid)) {
      eq(
        (built.grid as Record<string, boolean[]>)[row].length,
        p.steps,
        `${p.id}:${row}`
      );
    }
  }
});

suite("styles and quick starts");

test("bass and melody styles are well-formed", () => {
  eq(new Set(BASS_STYLES.map((b) => b.id)).size, BASS_STYLES.length);
  ok(BASS_STYLES.length >= 6, "bass variety");
  eq(new Set(MELODY_STYLES.map((m) => m.id)).size, MELODY_STYLES.length);
  for (const m of MELODY_STYLES) {
    ok(m.density > 0 && m.density <= 1, `${m.id} density`);
  }
  ok(MOODS.length >= 10, "mood variety");
  ok(INSTRUMENT_DEFS.length >= 10, "instrument variety");
});

test("every quick start references real presets", () => {
  const progIds = new Set(CHORD_PROGRESSIONS.map((p) => p.id));
  const drumIds = new Set(DRUM_PRESETS.map((p) => p.id));
  eq(new Set(QUICK_STARTS.map((q) => q.id)).size, QUICK_STARTS.length);
  for (const q of QUICK_STARTS) {
    ok(progIds.has(q.progressionId), `${q.id} progression`);
    ok(drumIds.has(q.drumId), `${q.id} drums`);
    ok(q.bpm >= 50 && q.bpm <= 180, `${q.id} bpm`);
    ok(q.energy >= 1 && q.energy <= 10, `${q.id} energy`);
    ok(q.scale === "major" || q.scale === "minor", `${q.id} scale`);
    ok(q.tonic.length > 0 && q.title.length > 0, `${q.id} text`);
  }
});
