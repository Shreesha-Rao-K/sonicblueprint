// V4 playback: fast-start preparation + live editing while playing.
// The engine needs Web Audio for play(), so these tests target the pure
// planning layer the engine actually uses: bank selection (what preparation
// loads), horizon invalidation (what an edit rebases), and revision/position
// safety. Browser QA covers the audible remainder.
import { suite, test, eq, ok } from "./helpers";
import {
  banksInFirstUseOrder,
  buildSongEvents,
  sampledNoteVoices,
} from "@/lib/audio-engine";
import {
  SCHEDULER_HORIZON,
  planIndices,
  rebaseIndices,
} from "@/lib/live-plan";
import { createProject, type SonicProject } from "@/lib/project-schema";

function offProject(name: string): SonicProject {
  const base = createProject(name);
  return { ...base, config: { ...base.config, humanize: "off" } };
}

suite("fast-start bank selection");

test("only banks the song will sound are queued", () => {
  const song = buildSongEvents(offProject("Q"));
  const ids = banksInFirstUseOrder(song.notes, song.drums);
  ok(ids.includes("grand-piano"), "piano needed");
  ok(ids.includes("acoustic-drums"), "drums needed");
  for (const unused of ["violin-ensemble", "cello", "trumpet", "french-horn", "flute", "clarinet", "harp"]) {
    ok(!ids.includes(unused), `${unused} not queued`);
  }
});

test("disabled layers never trigger preparation", () => {
  const base = offProject("Layers");
  const noDrums: SonicProject = {
    ...base,
    layers: { ...base.layers, drums: false },
  };
  const ids = banksInFirstUseOrder(
    buildSongEvents(noDrums).notes,
    buildSongEvents(noDrums).drums
  );
  ok(!ids.includes("acoustic-drums"), "no drum bank without drum events");
  const noChords: SonicProject = {
    ...base,
    layers: { chords: true, drums: false, bass: false, melody: false },
    instruments: base.instruments.map((i) =>
      i.group === "piano" ? { ...i, enabled: false } : i
    ),
  };
  const s2 = buildSongEvents(noChords);
  ok(!banksInFirstUseOrder(s2.notes, s2.drums).includes("grand-piano"), "no piano bank");
});

test("banks order earliest use first", () => {
  const ids = banksInFirstUseOrder(
    [
      { time: 4.0, sample: "late-bank" },
      { time: 0.5, sample: "early-bank" },
      { time: 2.0 },
    ],
    [{ time: 1.0 }]
  );
  eq(ids, ["early-bank", "acoustic-drums", "late-bank"]);
});

test("empty plan queues nothing", () => {
  eq(banksInFirstUseOrder([], []), []);
});

test("unloaded banks resolve no voices: synthesis covers first notes", () => {
  // Fresh cache in the test env holds no decoded banks.
  eq(sampledNoteVoices("grand-piano", 60, 0.8), null);
  eq(sampledNoteVoices("no-such-bank", 60, 0.8), null);
});

suite("live-update boundary");

function grid(step: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({ time: i * step }));
}

test("rebase resumes past the already-scheduled horizon", () => {
  const notes = grid(0.5, 9); // 0 … 4.0
  const drums = grid(0.25, 17);
  const idx = rebaseIndices(notes, drums, 1.0);
  // Boundary = 1.0 + 0.14 + 0.005: first note at 1.5, first drum at 1.25.
  eq(notes[idx.noteIdx].time, 1.5);
  eq(drums[idx.drumIdx].time, 1.25);
  ok(notes[idx.noteIdx].time >= 1.0 + SCHEDULER_HORIZON, "past horizon");
});

test("no already-scheduled event is repeated", () => {
  const notes = grid(0.1, 40);
  for (const pos of [0, 0.37, 1.0, 2.55]) {
    const idx = rebaseIndices(notes, [], pos);
    for (let i = idx.noteIdx; i < notes.length; i++) {
      ok(notes[i].time >= pos + SCHEDULER_HORIZON, `pos ${pos}: no repeat`);
    }
    // Nothing before the boundary is reachable from the new indices.
    ok(idx.noteIdx >= 0 && idx.noteIdx <= notes.length, "in range");
  }
});

test("rebase is idempotent at a fixed position", () => {
  const notes = grid(0.25, 20);
  const drums = grid(0.5, 10);
  const a = rebaseIndices(notes, drums, 1.1);
  const b = rebaseIndices(notes, drums, 1.1);
  eq(a, b);
});

test("empty lists rebase to zero without crashing", () => {
  eq(rebaseIndices([], [], 3.0), { noteIdx: 0, drumIdx: 0 });
});

test("repeated rebases stay bounded", () => {
  const notes = grid(0.1, 200);
  const drums = grid(0.1, 200);
  let pos = 0;
  for (let i = 0; i < 200; i++) {
    pos += 0.05;
    const idx = rebaseIndices(notes, drums, pos);
    ok(idx.noteIdx <= notes.length && idx.drumIdx <= drums.length, "bounded");
  }
  eq(notes.length, 200);
  eq(drums.length, 200);
});

test("initial indices start exactly at the offset", () => {
  const notes = grid(0.5, 8);
  eq(planIndices(notes, 0), 0);
  eq(notes[planIndices(notes, 1.0)].time, 1.0);
});

test("horizon stays bounded: no whole-song pre-scheduling", () => {
  ok(SCHEDULER_HORIZON > 0, "positive");
  ok(SCHEDULER_HORIZON <= 0.5, `bounded (${SCHEDULER_HORIZON}s)`);
});

suite("live edits reuse the deterministic plan");

test("chord edit changes future material, not history", () => {
  const base = offProject("Chords");
  const before = buildSongEvents(base);
  const after = buildSongEvents({
    ...base,
    chords: { ...base.chords, chords: ["Em", "C", "G", "D"] },
  });
  const pos = 5.0;
  const idx = rebaseIndices(after.notes, after.drums, pos);
  ok(idx.noteIdx > 0, "skips played history");
  ok(after.notes[idx.noteIdx].time >= pos, "future only");
  // Same seed + same structure shape: rebuild is deterministic.
  eq(
    JSON.stringify(buildSongEvents({ ...base, chords: { ...base.chords, chords: ["Em", "C", "G", "D"] } }).notes),
    JSON.stringify(after.notes)
  );
  ok(before.notes.length > 0 && after.notes.length > 0, "both render");
});

test("BPM change retimes future events on the new grid", () => {
  const base = offProject("Bpm");
  const slow: SonicProject = { ...base, config: { ...base.config, bpm: 100 } };
  const fast: SonicProject = { ...base, config: { ...base.config, bpm: 140 } };
  const sSlow = buildSongEvents(slow);
  const sFast = buildSongEvents(fast);
  // Same bars, faster tempo: proportionally shorter, still finite.
  const bars = slow.arrangement.reduce((a, s) => a + s.bars, 0);
  eq(sFast.duration, (bars * 4 * 60) / 140);
  ok(Math.abs(sSlow.duration - (bars * 4 * 0.6)) < 1e-9, "slow grid intact");
  for (const n of [...sFast.notes, ...sFast.drums]) {
    ok(Number.isFinite(n.time) && n.time >= 0, "finite future timing");
  }
  // Live boundary lands on the new plan without repeats.
  const idx = rebaseIndices(sFast.notes, sFast.drums, 2.0);
  ok(sFast.notes[idx.noteIdx].time >= 2.0, "future on new grid");
});

test("layer toggle drops that layer's future events", () => {
  const base = offProject("Toggle");
  const muted: SonicProject = {
    ...base,
    layers: { chords: false, drums: false, bass: false, melody: true },
  };
  const s = buildSongEvents(muted);
  ok(s.notes.length > 0, "melody remains");
  ok(s.drums.length === 0, "drums gone");
  ok(!s.notes.some((n) => n.synth === "piano" || n.synth === "bass"), "pitched rhythm gone");
  const idx = rebaseIndices(s.notes, s.drums, 1.0);
  ok(idx.drumIdx === 0, "empty drums safe");
});

test("feel change keeps composition, re-performs delivery", () => {
  const base = createProject("Feel");
  const off = buildSongEvents({ ...base, config: { ...base.config, humanize: "off" } });
  const nat = buildSongEvents({ ...base, config: { ...base.config, humanize: "natural" } });
  eq(nat.notes.map((n) => n.midi), off.notes.map((n) => n.midi));
  const idx = rebaseIndices(nat.notes, nat.drums, 1.0);
  ok(nat.notes[idx.noteIdx].time >= 1.0, "rebases on performed plan");
});
