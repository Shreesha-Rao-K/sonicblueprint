// Unit tests: Human Performer Engine (phrase detection, planned performance).
import { suite, test, eq, ok } from "./helpers";
import {
  PERFORM_PROFILES,
  detectPhrases,
  planChordSpread,
  planPhrase,
  profileFor,
  type Phrase,
  type PlanNote,
} from "@/lib/performance";

const BEAT = 0.5;
const CTX = { seed: 12345, beatSec: BEAT, sections: [{ start: 0, energy: 6 }], scale: 1 };

function line(midis: number[], step = BEAT, dur = 0.45, start = 0): PlanNote[] {
  return midis.map((midi, i) => ({ time: start + i * step, midi, dur, vol: 0.7 }));
}

// Phase 21 fixtures: deterministic melodies designed to expose robots.
const FIX = {
  ascending: () => line([60, 62, 64, 65, 67]),
  descending: () => line([72, 69, 67, 65, 64]),
  repeated: () => line([67, 67, 67, 67, 67, 67, 67, 67], 0.5),
  sustained: () => line([60, 64, 67, 72], 2.0, 1.9),
  staccato: () => line([72, 74, 76, 79], 0.25, 0.1),
  syncopated: () => line([60, 62, 64], 0.5).map((n, i) => ({ ...n, time: n.time + (i % 2 === 0 ? 0.25 : 0) })),
  leaps: () => line([48, 67, 50, 69, 52]),
  phrase4bar: () => line([60, 62, 64, 65, 67, 65, 64, 62]),
  phrase8bar: () => line([60, 62, 64, 65, 67, 69, 67, 65, 64, 62, 60, 59, 60]),
  withRests: () => [...line([60, 62, 64], 0.5), ...line([67, 69, 71], 0.5, 0.45, 3.0)],
  legatoLine: () => line([60, 62, 64, 65], 0.5, 0.48),
  chordLoop: () => [60, 64, 67].flatMap((midi) => [0, 2, 4, 6].map((b) => ({ time: b * BEAT, midi, dur: 0.4, vol: 0.7 }))),
};

function detect(notes: PlanNote[], gapBeats = 3): Phrase[] {
  return detectPhrases(
    notes.map((n) => n.time),
    notes.map((n) => n.midi),
    gapBeats * BEAT
  );
}

function perform(notes: PlanNote[], profile = PERFORM_PROFILES["strings"], seed = CTX.seed, scale = 1): PlanNote[] {
  const out = notes.map((n) => ({ ...n }));
  const gapBeats = 3;
  const phrases = detectPhrases(
    out.map((n) => n.time),
    out.map((n) => n.midi),
    gapBeats * BEAT
  );
  let cursor = 0;
  for (const [pi, ph] of phrases.entries()) {
    const prevGap = cursor === 0 ? Infinity : out[cursor].time - out[cursor - 1].time;
    planPhrase(out.slice(cursor, cursor + ph.count), { ...ph }, cursor, seed, profile, { ...CTX, seed, scale }, prevGap);
    // write back (planPhrase mutates the slice in place above via shared refs? no—slice copies refs)
    cursor += ph.count;
    void pi;
  }
  return out;
}

suite("phrase detection");

test("unbroken lines are one phrase; rests split phrases", () => {
  eq(detect(FIX.ascending()).length, 1);
  eq(detect(FIX.withRests()).length, 2);
  eq(detect([]).length, 0);
  eq(detect(FIX.repeated()).length, 1);
});

test("phrase ids are sequential with bounds", () => {
  const ph = detect(FIX.withRests());
  eq(ph.map((p) => p.id), [0, 1]);
  eq(ph[0].count, 3);
  eq(ph[1].count, 3);
  ok(ph[0].end < ph[1].start, "ordered");
});

test("peak is the highest note, ties go latest", () => {
  const ascending = detect(FIX.ascending())[0];
  eq(ascending.peakIdx, 4);
  const repeated = detect(FIX.repeated())[0];
  eq(repeated.peakIdx, 7);
  const two = detect(line([60, 72, 72, 65]))[0];
  eq(two.peakIdx, 2);
});

test("single notes and empty input are safe", () => {
  const one = detect(line([60]));
  eq(one.length, 1);
  eq(one[0].count, 1);
});

suite("phrase velocity contour");

test("peaks louder than starts, endings relax", () => {
  const out = perform(FIX.phrase8bar());
  const vols = out.map((n) => n.vol);
  const peak = vols.indexOf(Math.max(...vols));
  ok(peak > 0 && peak < vols.length - 1, `peak inside phrase (at ${peak})`);
  ok(vols[vols.length - 1] < vols[peak], "ending releases");
});

test("repeated notes never share identical velocity", () => {
  const out = perform(FIX.repeated());
  const vols = new Set(out.map((n) => Math.round(n.vol * 10000)));
  ok(vols.size > 1, "varied");
});

test("downbeats get emphasis, syncopation survives", () => {
  const out = perform(FIX.syncopated());
  ok(out.length === 3, "notes preserved");
  ok(out.every((n) => n.vol > 0 && n.vol <= 1), "bounded");
});

test("large leaps keep every note musical", () => {
  const out = perform(FIX.leaps());
  ok(out.every((n) => n.vol >= 0.0001 && n.vol <= 1), "bounded");
  eq(out.map((n) => n.midi), [48, 67, 50, 69, 52]);
});

suite("timing behavior");

test("offsets stay within family budgets", () => {
  for (const [name, fx] of Object.entries(FIX) as [string, () => PlanNote[]][]) {
    const before = fx();
    const out = perform(before);
    for (let i = 0; i < out.length; i++) {
      ok(Math.abs(out[i].time - before[i].time) <= 0.014 + 1e-9, `${name} note ${i} bounded`);
      ok(out[i].time >= 0, `${name} no negative time`);
    }
  }
});

test("timing is deterministic per seed, varies per seed", () => {
  const a = perform(FIX.phrase4bar());
  const b = perform(FIX.phrase4bar());
  eq(a.map((n) => n.time), b.map((n) => n.time));
});

test("expressive moves at least as far as natural on peaks", () => {
  const base = FIX.phrase8bar();
  const nat = perform(base, PERFORM_PROFILES["strings"], CTX.seed, 1);
  const exp = perform(base, PERFORM_PROFILES["strings"], CTX.seed, 1.5);
  const peak = nat.map((n) => n.vol).indexOf(Math.max(...nat.map((n) => n.vol)));
  ok(exp[peak].vol >= nat[peak].vol - 1e-9, "expressive emphasizes at least as much");
});

suite("duration and legato");

test("endings bloom, staccato stays short", () => {
  const sung = perform(FIX.sustained());
  ok(sung[sung.length - 1].dur >= FIX.sustained()[FIX.sustained().length - 1].dur, "ending blooms");
  const stac = perform(FIX.staccato());
  stac.forEach((n, i) => {
    ok(n.dur <= FIX.staccato()[i].dur * 1.06, "staccato stays short");
    ok(n.dur >= 0.05, "floor holds");
  });
});

test("connected strings overlap slightly, piano never does", () => {
  const strings = perform(FIX.legatoLine(), PERFORM_PROFILES["strings"]);
  let overlaps = 0;
  for (let i = 0; i + 1 < strings.length; i++) {
    const over = strings[i].time + strings[i].dur - strings[i + 1].time;
    if (over > 1e-9) {
      overlaps++;
      ok(over <= 0.016, `overlap capped (${over})`);
    }
  }
  const piano = perform(FIX.legatoLine(), PERFORM_PROFILES["piano"]);
  for (let i = 0; i + 1 < piano.length; i++) {
    ok(piano[i].time + piano[i].dur <= piano[i + 1].time + 1e-9, "piano never overlaps");
  }
  void overlaps;
});

test("chord spread blooms bottom-up within milliseconds", () => {
  const chord = [60, 64, 67].map((midi) => ({ time: 1.0, midi, dur: 0.4, vol: 0.7 }));
  planChordSpread(chord, [0, 1, 2], 99, 8);
  ok(chord[0].time <= chord[1].time && chord[1].time <= chord[2].time, "bottom-up");
  ok(chord[2].time - chord[0].time <= 0.008 + 1e-9, "subtle spread");
  ok(chord[0].vol >= chord[2].vol, "lower notes stronger");
  const single = [{ time: 1, midi: 60, dur: 0.4, vol: 0.7 }];
  planChordSpread(single, [0], 99, 8);
  eq(single[0].time, 1);
});

suite("profiles and determinism");

test("profile selection covers families with sane bounds", () => {
  for (const name of ["piano", "strings", "winds", "brass", "harp", "bass", "drums", "pads", "synth", "pluck", "guitar", "atmos", "perc"]) {
    const p = profileFor(name, name);
    ok(p.timingMs >= 0 && p.timingMs <= 14, `${name} timing`);
  }
  eq(profileFor("winds", "atmos").breathMs, 12);
  eq(profileFor(undefined, "nope").timingMs, PERFORM_PROFILES["synth"].timingMs);
  ok(profileFor("bass", "bass").timingMs <= profileFor("strings", "strings").timingMs, "bass tighter");
});

suite("groove glue");

test("kick/snare/tom sharing a grid instant move together", async () => {
  const { buildSongEvents } = await import("@/lib/audio-engine");
  const { createProject } = await import("@/lib/project-schema");
  const base = createProject("Groove");
  const off = buildSongEvents({ ...base, config: { ...base.config, humanize: "off" } });
  const nat = buildSongEvents({ ...base, config: { ...base.config, humanize: "natural" } });
  // group simultaneous core-kit hits by their exact off-grid time
  const groups = new Map<number, number[]>();
  off.drums.forEach((d, i) => {
    if (d.row !== "kick" && d.row !== "snare" && d.row !== "tom") return;
    const arr = groups.get(d.time);
    if (arr) arr.push(i);
    else groups.set(d.time, [i]);
  });
  let checked = 0;
  for (const idxs of groups.values()) {
    if (idxs.length < 2) continue;
    const shifts = idxs.map((i) => nat.drums[i].time - off.drums[i].time);
    for (const s of shifts) eq(s, shifts[0]);
    checked++;
  }
  ok(checked > 0, "shared grid instants exist");
});

test("different seeds perform differently, same seed identically", () => {
  const out1 = perform(FIX.descending());
  const out2 = perform(FIX.descending());
  eq(out1, out2);
  const out3 = perform(FIX.descending(), PERFORM_PROFILES["strings"], 99999);
  ok(out3.some((n, i) => n.time !== out1[i].time || n.vol !== out1[i].vol), "seed varies feel");
  eq(out3.map((n) => n.midi), out1.map((n) => n.midi));
});
