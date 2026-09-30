// Audio-engine QA harness — runs against REAL source via tsx (respects tsconfig paths).
// Usage: npx -y tsx qa/audio-qa.mts
// Excluded from Next build typecheck via tsconfig.
// Deterministic: all assertions use seeded/derived projects, no wall-clock audio.

import { buildSongEvents, projectDurationSec, quarterBeatsPerBar } from "@/lib/audio-engine";
import {
  chordMidiNotes, generateMelody, parseChord, rootToPc,
  scalePcs, transposeProgression,
} from "@/lib/music-theory";
import {
  createProject, defaultDrums, type SonicProject,
} from "@/lib/project-schema";

let pass = 0;
let fail = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(`${name} :: ${detail}`);
    console.log(`FAIL ${name} :: ${detail}`);
  }
}

function approx(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

const P = createProject("QA");

// ── 1. duration math across time signatures & tempi ──
for (const ts of ["4/4", "3/4", "6/8", "12/8"] as const) {
  for (const bpm of [60, 100, 128, 180]) {
    const p: SonicProject = { ...P, config: { ...P.config, bpm, timeSignature: ts } };
    const s = buildSongEvents(p);
    check(`duration ${ts}@${bpm}`, approx(s.duration, projectDurationSec(p)),
      `song=${s.duration} helper=${projectDurationSec(p)}`);
    const bars = p.arrangement.reduce((a, x) => a + x.bars, 0);
    check(`bardur ${ts}@${bpm}`, approx(s.duration, bars * quarterBeatsPerBar(ts) * (60 / bpm)),
      `${s.duration}`);
  }
}

// ── 2. section boundaries contiguous, events start on grid, none start past end ──
{
  const s = buildSongEvents(P);
  const spq = 60 / P.config.bpm;
  const qpb = quarterBeatsPerBar(P.config.timeSignature);
  const barDur = spq * qpb;
  const starts = s.notes.map((n) => n.time).concat(s.drums.map((d) => d.time));
  check("events-start-nonneg", starts.every((t) => t >= -1e-9), `${Math.min(...starts)}`);
  check("events-start-before-end", starts.every((t) => t < s.duration + 1e-9), `${Math.max(...starts)} vs ${s.duration}`);
  // drum events land exactly on step grid (with swing only on odd steps)
  const bad = s.drums.filter((d) => {
    const q = d.time / barDur;
    const bar = Math.floor(q + 1e-9);
    const frac = q - bar;
    const steps = P.drums.steps;
    // nearest step, allowing swing offset on odd steps
    const f = frac * steps;
    const k = Math.round(f);
    if (k < 0 || k > steps) return true;
    const swing = P.drums.swing;
    const want = swing > 0 && k % 2 === 1 ? k + (swing * 0.5) : k;
    return Math.abs(f - want) > 1e-6;
  });
  check("drums-on-grid", bad.length === 0, `${bad.length} off-grid`);
}

// ── 3. bass follows chord roots in several keys ──
for (const [tonic, scale, chords] of [
  ["D", "minor", ["Dm", "Bb", "F", "C"]],
  ["C", "major", ["C", "G", "Am", "F"]],
  ["F#", "minor", ["F#m", "D", "A", "E"]],
  ["Bb", "major", ["Bb", "F", "Gm", "Eb"]],
] as const) {
  const p: SonicProject = {
    ...P,
    config: { ...P.config, keyTonic: tonic, scale },
    chords: { ...P.chords, chords: [...chords] },
  };
  const s = buildSongEvents(p);
  const bass = s.notes.filter((n) => n.synth === "bass").sort((a, b) => a.time - b.time);
  check(`bass-nonempty ${tonic}${scale}`, bass.length > 0, `${bass.length}`);
  // first bass note of each chord slot should equal that chord's root pc
  const slots = new Map<number, number[]>(); // time -> pcs
  for (const n of bass) {
    const k = Math.round(n.time * 1000);
    if (!slots.has(k)) slots.set(k, []);
    slots.get(k)!.push(((n.midi % 12) + 12) % 12);
  }
  const expectedRoots = chords.map((c) => parseChord(c).rootPc);
  const times = [...slots.keys()].sort((a, b) => a - b).slice(0, chords.length);
  const got = times.map((t) => slots.get(t)![0]);
  check(`bass-roots ${tonic}${scale}`, got.join(",") === expectedRoots.join(","),
    `got ${got} want ${expectedRoots}`);
}

// ── 4. transposition integrity: engine renders each transposed chord's pitch classes ──
{
  const from = ["Dm", "Bb", "F", "C"];
  const to = transposeProgression(from, rootToPc("D"), rootToPc("E"));
  check("transpose-symbols", to.join(",") === "Em,C,G,D", to.join(","));
  const pTo: SonicProject = { ...P, chords: { ...P.chords, chords: to } };
  const s = buildSongEvents(pTo);
  const slotLen = pTo.chords.beatsPerChord * (60 / pTo.config.bpm);
  let ok = true;
  let detail = "";
  to.forEach((sym, k) => {
    const want = new Set(chordMidiNotes(sym, 3).map((m) => ((m % 12) + 12) % 12));
    const got = new Set(
      s.notes
        .filter((n) => n.synth === "piano" && Math.abs(n.time - k * slotLen) < 1e-6)
        .map((n) => ((n.midi % 12) + 12) % 12)
    );
    const match = want.size === got.size && [...want].every((pc) => got.has(pc));
    if (!match) {
      ok = false;
      detail += `slot${k}(${sym}) want ${[...want]} got ${[...got]}; `;
    }
  });
  check("transpose-rendered", ok, detail);
}

// ── 5. long chord durations honored (bpc=8 in 4/4 re-strikes every 2 bars, not every bar) ──
{
  const p: SonicProject = {
    ...P,
    chords: { ...P.chords, chords: ["Am", "F", "C", "G"], beatsPerChord: 8 },
  };
  const s = buildSongEvents(p);
  const spq = 60 / p.config.bpm;
  const pianoOnsets = s.notes
    .filter((n) => n.synth === "piano")
    .map((n) => n.time)
    .sort((a, b) => a - b);
  const uniq = pianoOnsets.filter((t, i) => i === 0 || t - pianoOnsets[i - 1] > 1e-9);
  const gaps = uniq.slice(1).map((t, i) => t - uniq[i]);
  check("long-chord-gaps", gaps.every((g) => g >= 8 * spq - 1e-6),
    `min gap ${Math.min(...gaps)}, want >= ${8 * spq}`);
}

// ── 6. swing offsets odd steps ──
{
  const drums = defaultDrums();
  // force a hat on every step so odd steps exist
  const grid = { ...drums.grid, hihat: Array.from({ length: 16 }, () => true) };
  const p: SonicProject = {
    ...P,
    arrangement: [{ id: "s", name: "VERSE", bars: 1, energy: 6, instruments: [] }],
    drums: { ...drums, grid, swing: 0.2 },
  };
  const s = buildSongEvents(p);
  const spq = 60 / p.config.bpm;
  const stepDur = (4 * spq) / 16;
  const hats = s.drums.filter((d) => d.row === "hihat").map((d) => d.time).sort((a, b) => a - b);
  check("swing-count", hats.length === 16, `${hats.length}`);
  const oddShift = hats[1] - (hats[0] + stepDur);
  check("swing-amount", approx(oddShift, stepDur * 0.2 * 0.5), `${oddShift} vs ${stepDur * 0.1}`);
  check("swing-even", approx(hats[2] - hats[0], 2 * stepDur), `${hats[2] - hats[0]}`);
}

// ── 7. melody: non-chord tones stay in scale; deterministic per seed ──
for (const [tonic, scale] of [["D", "minor"], ["C", "major"], ["A", "minor"]] as const) {
  const pcs = new Set(scalePcs(rootToPc(tonic), scale));
  const chords = tonic === "C" ? ["C", "G", "Am", "F"] : ["Dm", "Bb", "F", "C"];
  const p: SonicProject = {
    ...P,
    config: { ...P.config, keyTonic: tonic, scale },
    chords: { ...P.chords, chords: [...chords] },
  };
  const s = buildSongEvents(p);
  const mel = s.notes.filter((n) => n.synth === "pluck");
  check(`melody-nonempty ${tonic}${scale}`, mel.length > 0, `${mel.length}`);
  // group melody notes by chord slot: any mel note whose pc is not a chord tone of the
  // sounding chord must be in scale. Slot math mirrors the engine's integer grid
  // (round-then-floor defeats float drift at slot boundaries).
  const bad: number[] = [];
  const slotLen = p.chords.beatsPerChord * (60 / p.config.bpm);
  const slotOf = (t: number) => Math.floor(Number((t / slotLen).toFixed(9)));
  for (const n of mel) {
    const ci = ((slotOf(n.time) % chords.length) + chords.length) % chords.length;
    const tones = new Set(chordMidiNotes(chords[((ci % chords.length) + chords.length) % chords.length], 3).map((m) => ((m % 12) + 12) % 12));
    const pc = ((n.midi % 12) + 12) % 12;
    if (!tones.has(pc) && !pcs.has(pc)) bad.push(n.midi);
  }
  check(`melody-in-scale ${tonic}${scale}`, bad.length === 0, `out: ${bad.slice(0, 8)}`);
  const again = buildSongEvents(p);
  const h = (x: ReturnType<typeof buildSongEvents>) =>
    x.notes.map((n) => `${n.time.toFixed(4)}:${n.midi}:${n.vol.toFixed(4)}`).join("|");
  check(`melody-deterministic ${tonic}${scale}`, h(s) === h(again), "nondeterministic!");
}

// ── 8. multiple simultaneous instruments of same group all sound ──
{
  const p: SonicProject = {
    ...P,
    chords: { ...P.chords, chords: ["C"] },
    arrangement: [{ id: "s", name: "VERSE", bars: 1, energy: 6, instruments: [] }],
    instruments: [
      { id: "a", group: "piano", name: "P1", enabled: true, volume: 0.8, pan: 0, octave: 0, role: "chords", style: "soft", patternVariant: "block" },
      { id: "b", group: "piano", name: "P2", enabled: true, volume: 0.8, pan: 0, octave: 1, role: "chords", style: "soft", patternVariant: "block" },
    ],
  };
  const s = buildSongEvents(p);
  const midis = new Set(s.notes.map((n) => n.midi));
  const base = chordMidiNotes("C", 3);
  const layered = base.every((m) => midis.has(m) && midis.has(m + 12));
  check("multi-piano-layers", layered, `notes=${s.notes.length}`);
}

// ── 9. robustness: empty chords / empty arrangement / extreme bpm ──
{
  const e1: SonicProject = { ...P, chords: { ...P.chords, chords: [] } };
  const s1 = buildSongEvents(e1);
  check("empty-chords-fallback", s1.notes.length > 0 && s1.duration > 0, "");
  const e2: SonicProject = { ...P, arrangement: [] };
  const s2 = buildSongEvents(e2);
  check("empty-arrangement", s2.notes.length === 0 && s2.drums.length === 0, `${s2.notes.length}`);
  const e3: SonicProject = { ...P, config: { ...P.config, bpm: 5 } };
  const s3 = buildSongEvents(e3);
  check("bpm-clamped", s3.duration > 0 && s3.duration < 1e5, `${s3.duration}`);
}

// ── 10. midi range safety against crafted imports ──
{
  const p: SonicProject = {
    ...P,
    chords: { ...P.chords, chords: ["C"], octave: 20 },
    instruments: P.instruments.map((i) => ({ ...i, octave: 2 })),
  };
  const s = buildSongEvents(p);
  check("midi-clamped", s.notes.every((n) => n.midi >= 0 && n.midi <= 127),
    `${Math.min(...s.notes.map((n) => n.midi))}..${Math.max(...s.notes.map((n) => n.midi))}`);
}

// ── 11. sectionAt/chordAt monotonic + final boundaries ──
{
  const s = buildSongEvents(P);
  let mono = true;
  const prevC = -1;
  let prevS = -1;
  for (let t = 0; t <= s.duration; t += s.duration / 200) {
    const c = s.chordAt(t);
    const si = s.sectionAt(t);
    if (si < prevS) mono = false;
    prevS = si;
    void c;
    void prevC;
  }
  check("sectionAt-monotonic", mono, "");
  check("sectionAt-end", s.sectionAt(s.duration) === P.arrangement.length - 1,
    `${s.sectionAt(s.duration)}`);
}

// ── 12. generateMelody unit sanity ──
{
  const m = generateMelody(["Dm"], 4, rootToPc("D"), "minor", "seed-x", 0.6);
  check("melody-bounds", m.every((n) => n.startBeat >= 0 && n.startBeat < 4), JSON.stringify(m.slice(0, 2)));
  check("melody-count", m.length >= 2 && m.length <= 16, `${m.length}`);
}

console.log(`\nAUDIO QA: ${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log("FAILURES:\n" + failures.join("\n"));
  process.exit(1);
}
