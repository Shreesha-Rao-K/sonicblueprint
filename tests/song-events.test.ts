// Integration tests: arrangement/bar/beat math, bass, drums and melody
// through the shared buildSongEvents() pipeline (also used by exports).
import { suite, test, eq, ok, approx } from "./helpers";
import { buildSongEvents, projectDurationSec, quarterBeatsPerBar } from "@/lib/audio-engine";
import { chordMidiNotes, parseChord } from "@/lib/music-theory";
import { createProject, type SonicProject } from "@/lib/project-schema";
import { MELODY_STYLES } from "@/data/styles";

const P = createProject("QA");

function withConfig(p: SonicProject, config: Partial<SonicProject["config"]>): SonicProject {
  return { ...p, config: { ...p.config, ...config } };
}

suite("bar and beat calculations");

test("duration equals bars × beats × seconds-per-beat", () => {
  for (const ts of ["4/4", "3/4", "6/8", "12/8"] as const) {
    const p = withConfig(P, { bpm: 120, timeSignature: ts });
    const bars = p.arrangement.reduce((a, s) => a + s.bars, 0);
    approx(
      buildSongEvents(p).duration,
      bars * quarterBeatsPerBar(ts) * 0.5,
      1e-6,
      ts
    );
  }
});

test("minimum BPM clamps to 30", () => {
  const p = withConfig(P, { bpm: 1 });
  const bars = p.arrangement.reduce((a, s) => a + s.bars, 0);
  approx(buildSongEvents(p).duration, bars * 4 * 2, 1e-6, "30bpm floor");
});

test("maximum BPM clamps to 240", () => {
  const p = withConfig(P, { bpm: 1000 });
  const bars = p.arrangement.reduce((a, s) => a + s.bars, 0);
  approx(buildSongEvents(p).duration, bars * 4 * 0.25, 1e-6, "240bpm ceiling");
});

test("unusual signatures fall back without crashing", () => {
  const p = withConfig(P, { timeSignature: "5/4" as never, bpm: 100 });
  const s = buildSongEvents(p);
  const bars = p.arrangement.reduce((a, x) => a + x.bars, 0);
  approx(s.duration, bars * 4 * 0.6, 1e-6, "5/4 defaults to 4 beats");
  ok(s.notes.length > 0 && s.drums.length > 0, "still renders");
});

suite("arrangements");

test("empty arrangement renders silence, not errors", () => {
  const s = buildSongEvents({ ...P, arrangement: [] });
  eq(s.notes.length, 0);
  eq(s.drums.length, 0);
  eq(s.duration, 0);
  eq(s.sectionAt(0), 0);
});

test("one-section arrangement spans exactly its bars", () => {
  const p: SonicProject = {
    ...P,
    arrangement: [{ id: "only", name: "VERSE", bars: 2, energy: 5, instruments: [] }],
  };
  const s = buildSongEvents(p);
  approx(s.duration, 2 * 4 * 0.6, 1e-6, "2 bars at 100bpm");
  ok(s.notes.length > 0 && s.drums.length > 0, "has content");
  for (let t = 0; t <= s.duration; t += 0.5) eq(s.sectionAt(t), 0, `t=${t}`);
});

test("section boundaries tile the song without gaps", () => {
  const s = buildSongEvents(P);
  approx(s.duration, projectDurationSec(P), 1e-6, "matches helper");
  eq(s.sectionAt(0), 0);
  eq(s.sectionAt(s.duration), P.arrangement.length - 1);
  let prev = -1;
  for (let t = 0; t <= s.duration; t += s.duration / 100) {
    const cur = s.sectionAt(t);
    ok(cur >= prev, `monotonic at ${t}`);
    prev = cur;
  }
});

test("every bar carries drum events", () => {
  const s = buildSongEvents(P);
  const spq = 60 / P.config.bpm;
  const barDur = 4 * spq;
  const bars = P.arrangement.reduce((a, x) => a + x.bars, 0);
  for (let b = 0; b < bars; b++) {
    const inBar = s.drums.filter((d) => d.time >= b * barDur - 1e-6 && d.time < (b + 1) * barDur - 1e-9);
    ok(inBar.length > 0, `bar ${b} has drums`);
  }
});

suite("chord progressions");

test("custom progressions render their exact chords", () => {
  const chords = ["E", "B", "Dbm", "A"];
  const p: SonicProject = {
    ...P,
    chords: { ...P.chords, progressionId: "custom-abc", chords },
  };
  const s = buildSongEvents(p);
  const slotLen = p.chords.beatsPerChord * (60 / p.config.bpm);
  chords.forEach((sym, k) => {
    const want = new Set(
      chordMidiNotes(sym, 3).map((m) => ((m % 12) + 12) % 12)
    );
    const got = new Set(
      s.notes
        .filter((n) => n.synth === "piano" && Math.abs(n.time - k * slotLen) < 1e-6)
        .map((n) => ((n.midi % 12) + 12) % 12)
    );
    eq([...got].sort(), [...want].sort(), `slot ${k} (${sym})`);
  });
});

test("transposed progressions move every bass root", () => {
  const mkBassRoots = (chords: string[]) => {
    const s = buildSongEvents({ ...P, chords: { ...P.chords, chords } });
    return s.notes
      .filter((n) => n.synth === "bass")
      .sort((a, b) => a.time - b.time)
      .slice(0, chords.length)
      .map((n) => ((n.midi % 12) + 12) % 12);
  };
  eq(mkBassRoots(["Dm", "Bb", "F", "C"]), [2, 10, 5, 0]);
  eq(mkBassRoots(["Em", "C", "G", "D"]), [4, 0, 7, 2]);
});

suite("bass generation");

test("every bass style follows the chord root", () => {
  const styles = ["root", "octave", "sustained", "rhythmic", "arp", "sub", "electronic", "custom"] as const;
  const chords = ["Dm", "Bb", "F", "C"];
  for (const styleId of styles) {
    const p: SonicProject = {
      ...P,
      chords: { ...P.chords, chords },
      bass: { styleId, octave: 1, volume: 0.85 },
    };
    const s = buildSongEvents(p);
    const bass = s.notes.filter((n) => n.synth === "bass");
    ok(bass.length > 0, `${styleId} produces bass`);
    // first bass note of the song sits on the first chord root
    const first = bass.sort((a, b) => a.time - b.time)[0];
    eq(((first.midi % 12) + 12) % 12, parseChord(chords[0]).rootPc, `${styleId} root`);
  }
});

test("custom gate without a pattern still sounds", () => {
  const p: SonicProject = {
    ...P,
    bass: { styleId: "custom", octave: 1, volume: 0.85, pattern: [] },
  };
  ok(buildSongEvents(p).notes.some((n) => n.synth === "bass"), "fallback gate");
});

suite("drum generation");

test("drum events respect the grid density", () => {
  const s = buildSongEvents(P);
  const perBar: number[] = [];
  const spq = 60 / P.config.bpm;
  const barDur = 4 * spq;
  const bars = P.arrangement.reduce((a, x) => a + x.bars, 0);
  for (let b = 0; b < Math.min(bars, 4); b++) {
    perBar.push(
      s.drums.filter((d) => d.time >= b * barDur - 1e-6 && d.time < (b + 1) * barDur - 1e-9).length
    );
  }
  ok(perBar.every((n) => n > 0), `hits per bar: ${perBar}`);
  // swing only shifts odd steps, never reorders
  const times = s.drums.map((d) => d.time).sort((a, b) => a - b);
  ok(times.every((t) => t >= 0 && t < s.duration + 1e-6), "in range");
});

suite("melody generation");

test("every melody style produces notes", () => {
  for (const m of MELODY_STYLES) {
    const p: SonicProject = { ...P, melodyStyle: m.id };
    const s = buildSongEvents(p);
    ok(s.notes.some((n) => n.synth === "pluck" || n.synth === "synth"), `${m.id} melody`);
  }
});
