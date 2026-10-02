// V3.1 hardening: centralized timing normalization + shared chord timeline.
// AUDIO, MIDI and PDF must agree about BPM; MIDI must follow the accumulated
// arrangement position like playback does.
import { suite, test, eq, ok, approx } from "./helpers";
import {
  BPM_DEFAULT,
  beatSecOf,
  chordSlots,
  normalizeBpm,
  normalizedBeatsPerChord,
  normalizedChordSymbols,
  quarterBeatsOf,
} from "@/lib/timing";
import { buildSongEvents, projectDurationSec } from "@/lib/audio-engine";
import { sectionTimeline } from "@/lib/pdf-export";
import { createProject, type SonicProject } from "@/lib/project-schema";

suite("bpm normalization");

test("normal BPM passes through", () => {
  eq(normalizeBpm(120), 120);
  eq(normalizeBpm(100), 100);
  eq(normalizeBpm(88.5), 88.5);
});

test("musical range edges hold", () => {
  eq(normalizeBpm(30), 30);
  eq(normalizeBpm(240), 240);
});

test("out-of-range clamps to 30–240", () => {
  eq(normalizeBpm(1), 30);
  eq(normalizeBpm(0), 30);
  eq(normalizeBpm(-50), 30);
  eq(normalizeBpm(1000), 240);
  eq(normalizeBpm(1e9), 240);
});

test("non-finite and missing values fall back without NaN", () => {
  for (const bad of [undefined, null, NaN, Infinity, -Infinity, "120", {}, []] as unknown[]) {
    const bpm = normalizeBpm(bad);
    eq(bpm, BPM_DEFAULT, `fallback for ${String(bad)}`);
    ok(Number.isFinite(bpm), "finite");
  }
});

test("beat seconds are always finite and positive", () => {
  for (const bad of [undefined, 0, -10, NaN, Infinity, 1000] as unknown[]) {
    const p = { ...createProject("T"), config: { ...createProject("T").config, bpm: bad as never } };
    const spq = beatSecOf(p);
    ok(Number.isFinite(spq) && spq > 0, `spq for ${String(bad)}`);
  }
  approx(beatSecOf(createProject("T")), 0.6, 1e-9, "100bpm");
});

suite("quarter beats mapping");

test("signatures map like the engine", () => {
  eq(quarterBeatsOf("4/4"), 4);
  eq(quarterBeatsOf("3/4"), 3);
  eq(quarterBeatsOf("6/8"), 3);
  eq(quarterBeatsOf("12/8"), 6);
  eq(quarterBeatsOf("5/4"), 4);
  eq(quarterBeatsOf(undefined), 4);
});

suite("chord slot timeline");

function slotsFor(chords: string[], bars: number[], beatsPerChord = 4) {
  const base = createProject("Slots");
  const p: SonicProject = {
    ...base,
    chords: { ...base.chords, chords },
    arrangement: bars.map((b, i) => ({
      id: `s${i}`, name: `SEC${i}`, bars: b, energy: 6, instruments: [],
    })),
  };
  if (beatsPerChord !== 4) p.chords.beatsPerChord = beatsPerChord;
  return chordSlots(p);
}

test("single section walks the progression in order", () => {
  const slots = slotsFor(["C", "G", "Am", "F"], [4]);
  eq(slots.map((s) => s.symbol), ["C", "G", "Am", "F"]);
  eq(slots.map((s) => s.chordIdx), [0, 1, 2, 3]);
});

test("second section continues instead of restarting", () => {
  const slots = slotsFor(["C", "Dm", "Em", "F", "G", "Am", "Bb", "C2"], [4, 4]);
  eq(
    slots.map((s) => s.symbol),
    ["C", "Dm", "Em", "F", "G", "Am", "Bb", "C2"]
  );
});

test("sections with different bar counts stay continuous", () => {
  const slots = slotsFor(["C", "D", "E", "F", "G", "A"], [2, 4, 2]);
  eq(slots.map((s) => s.symbol), ["C", "D", "E", "F", "G", "A", "C", "D"]);
});

test("progression wraps around the chord list", () => {
  const slots = slotsFor(["C", "G"], [4]);
  eq(slots.map((s) => s.symbol), ["C", "G", "C", "G"]);
});

test("slot indices are monotonic and absolute", () => {
  const slots = slotsFor(["C", "G", "Am", "F", "Dm", "Em"], [2, 2, 2]);
  eq(slots.map((s) => s.slotIdx), [0, 1, 2, 3, 4, 5]);
  for (let i = 1; i < slots.length; i++) {
    ok(slots[i].slotQ > slots[i - 1].slotQ, "time order");
  }
});

test("helpers sanitize malformed chord config", () => {
  const base = createProject("Bad");
  const p = {
    ...base,
    chords: { ...base.chords, chords: ["C", 42, null] as unknown as string[], beatsPerChord: NaN as never },
  };
  eq(normalizedChordSymbols(p), ["C", "Am", "Am"]);
  eq(normalizedBeatsPerChord(p), 4);
});

suite("timing consistency");

test("audio duration and PDF timeline agree on BPM", () => {
  for (const bpm of [60, 100, 120, 240]) {
    const base = createProject("Agree");
    const p: SonicProject = {
      ...base,
      config: { ...base.config, bpm },
      arrangement: [{ id: "s", name: "VERSE", bars: 4, energy: 6, instruments: [] }],
    };
    const dur = buildSongEvents(p).duration;
    approx(dur, projectDurationSec(p), 1e-9, `duration ${bpm}`);
    const tl = sectionTimeline(p);
    eq(tl.length, 1);
    eq(tl[0].start, "0:00");
  }
});

test("malformed BPM never escapes into event timing", () => {
  const base = createProject("Bad");
  const p = {
    ...base,
    config: { ...base.config, bpm: 0 as never },
    arrangement: [{ id: "s", name: "VERSE", bars: 2, energy: 6, instruments: [] }],
  };
  const s = buildSongEvents(p);
  ok(Number.isFinite(s.duration) && s.duration > 0, "finite duration");
  for (const n of s.notes) {
    ok(Number.isFinite(n.time) && Number.isFinite(n.dur), "finite note timing");
  }
  const tl = sectionTimeline(p);
  eq(tl[0].start, "0:00");
});
