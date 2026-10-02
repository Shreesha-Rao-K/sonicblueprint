// Tests: musical layer toggles (chords/drums/bass/melody).
// Covers schema v4, event gating, MIDI/PDF reflection, persistence,
// undo/redo and JSON round-trips.
import { suite, test, eq, ok } from "./helpers.js";
import { buildSongEvents } from "@/lib/audio-engine";
import { exportMidi } from "@/lib/midi-export";
import { exportPdf } from "@/lib/pdf-export";
import {
  createProject,
  defaultLayers,
  getLayers,
  normalizeProject,
  validateProject,
  type LayerId,
  type SonicProject,
} from "@/lib/project-schema";
import { Midi } from "@tonejs/midi";

const P = createProject("Layers");

function withLayers(p: SonicProject, patch: Partial<Record<LayerId, boolean>>): SonicProject {
  return { ...p, layers: { ...getLayers(p), ...patch } };
}

async function midiTracks(p: SonicProject): Promise<{ name: string; notes: number }[]> {
  const bytes = new Uint8Array(await (await exportMidi(p)).arrayBuffer());
  const parsed = new Midi(bytes);
  return parsed.tracks.map((t) => ({
    name: t.name || t.instrument.name,
    notes: t.notes.length,
  }));
}

async function pdfText(p: SonicProject): Promise<string> {
  const bytes = new Uint8Array(await (await exportPdf(p)).arrayBuffer());
  // jsPDF stores non-ASCII strings as UTF-16BE; strip nulls to search text.
  return Buffer.from(bytes).toString("latin1").replace(/\u0000/g, "");
}

suite("layer schema");

test("layers default to all ON", () => {
  eq(defaultLayers(), { chords: true, drums: true, bass: true, melody: true });
  eq(getLayers(P), { chords: true, drums: true, bass: true, melody: true });
});

test("new projects are schema v4 with layers on", () => {
  eq(P.schemaVersion, 4);
  ok(validateProject(P));
});

test("getLayers merges partial flags and coerces junk", () => {
  eq(getLayers({ ...P, layers: { ...getLayers(P), drums: false } }).drums, false);
  eq(getLayers({ ...P, layers: { ...getLayers(P), drums: false } }).bass, true);
  const junk = { ...P, layers: { chords: "yes", drums: 0, bass: null, melody: undefined } as never };
  const got = getLayers(junk);
  eq(got.drums, true);
  eq(got.bass, true);
});

test("v1 projects validate and normalize to all-ON v4", () => {
  const v1 = JSON.parse(JSON.stringify(P));
  delete v1.layers;
  v1.schemaVersion = 1;
  ok(validateProject(v1), "v1 loads");
  const norm = normalizeProject(v1 as SonicProject);
  eq(norm.schemaVersion, 4);
  eq(getLayers(norm), { chords: true, drums: true, bass: true, melody: true });
  // original musical data survives migration untouched
  eq(norm.chords.chords, P.chords.chords);
  eq(norm.drums.steps, P.drums.steps);
});

test("malformed layers are rejected", () => {
  const p = JSON.parse(JSON.stringify(P));
  p.layers = [true, false];
  ok(!validateProject(p), "array layers rejected");
});

suite("event gating");

test("drums OFF removes all drum events, keeps notes", () => {
  const s = buildSongEvents(withLayers(P, { drums: false }));
  eq(s.drums.length, 0);
  ok(s.notes.length > 0, "notes remain");
});

test("bass OFF removes bass notes only", () => {
  const before = buildSongEvents(P).notes.filter((n) => n.synth === "bass").length;
  ok(before > 0, "baseline has bass");
  const after = buildSongEvents(withLayers(P, { bass: false }));
  eq(after.notes.filter((n) => n.synth === "bass").length, 0);
  ok(after.notes.length > 0, "other notes remain");
});

test("melody OFF removes lead notes only", () => {
  const pluck = (s: ReturnType<typeof buildSongEvents>) =>
    s.notes.filter((n) => n.synth === "pluck").length;
  ok(pluck(buildSongEvents(P)) > 0, "baseline has melody");
  eq(pluck(buildSongEvents(withLayers(P, { melody: false }))), 0);
});

test("chords OFF removes harmony, keeps bass and melody", () => {
  const s = buildSongEvents(withLayers(P, { chords: false }));
  const kinds = new Set(s.notes.map((n) => n.synth));
  for (const k of kinds) {
    ok(k === "bass" || k === "pluck", `only bass+melody remain, found ${k}`);
  }
  ok(s.notes.some((n) => n.synth === "bass"), "bass kept");
  ok(s.notes.some((n) => n.synth === "pluck"), "melody kept");
});

test("all OFF yields empty but valid song", () => {
  const s = buildSongEvents(withLayers(P, { chords: false, drums: false, bass: false, melody: false }));
  eq(s.notes.length, 0);
  eq(s.drums.length, 0);
  ok(s.duration > 0, "duration intact");
});

test("toggling preserves underlying configuration", () => {
  const off = withLayers(P, { drums: false, bass: false });
  eq(off.drums.patternId, P.drums.patternId);
  eq(off.drums.grid, P.drums.grid);
  eq(off.bass.styleId, P.bass.styleId);
  const backOn = withLayers(off, { drums: true, bass: true });
  eq(buildSongEvents(backOn).drums.length, buildSongEvents(P).drums.length);
});

suite("MIDI reflects layers");

test("drums OFF produces no drum-channel notes", async () => {
  const on = await midiTracks(P);
  const off = await midiTracks(withLayers(P, { drums: false }));
  const drumNotes = (ts: { name: string; notes: number }[]) =>
    ts.filter((t) => t.name === "Drums").reduce((a, t) => a + t.notes, 0);
  ok(drumNotes(on) > 0, "baseline has drum events");
  eq(drumNotes(off), 0);
});

test("chords/bass/melody OFF empty their tracks only", async () => {
  const has = (ts: { name: string; notes: number }[], n: string) =>
    ts.filter((t) => t.name === n).reduce((a, t) => a + t.notes, 0);
  const base = await midiTracks(P);
  ok(has(base, "Chords") > 0 && has(base, "Bass") > 0 && has(base, "Melody") > 0, "baseline full");
  eq(has(await midiTracks(withLayers(P, { chords: false })), "Chords"), 0);
  eq(has(await midiTracks(withLayers(P, { bass: false })), "Bass"), 0);
  eq(has(await midiTracks(withLayers(P, { melody: false })), "Melody"), 0);
  // other tracks survive each toggle
  ok(has(await midiTracks(withLayers(P, { chords: false })), "Bass") > 0, "bass survives");
  ok(has(await midiTracks(withLayers(P, { drums: false })), "Melody") > 0, "melody survives");
});

suite("PDF reflects layers");

test("disabled layers are marked muted, enabled have no muted marks", async () => {
  const offText = await pdfText(withLayers(P, { drums: false, melody: false }));
  ok(offText.includes("MUSICAL LAYERS"), "layers section present");
  ok(offText.includes("muted"), "muted state present");
  const onText = await pdfText(P);
  ok(onText.includes("MUSICAL LAYERS"), "layers section present when on");
  ok(!onText.includes("muted"), "no muted marks when all on");
});

suite("persistence, undo and JSON");

test("toggle state survives JSON round-trip", () => {
  const p = withLayers(P, { drums: false, melody: false });
  const back = JSON.parse(JSON.stringify(p)) as SonicProject;
  ok(validateProject(back));
  eq(getLayers(back), { chords: true, drums: false, bass: true, melody: false });
});

test("undo and redo handle toggle changes", async () => {
  const { useProjectStore } = await import("@/store/project-store");
  const store = useProjectStore.getState();
  store.createNew("Undo Layers");
  ok(getLayers(useProjectStore.getState().project!).drums, "starts on");
  useProjectStore.getState().update((pr) => ({ ...pr, layers: { ...getLayers(pr), drums: false } }));
  eq(getLayers(useProjectStore.getState().project!).drums, false);
  useProjectStore.getState().undo();
  eq(getLayers(useProjectStore.getState().project!).drums, true);
  useProjectStore.getState().redo();
  eq(getLayers(useProjectStore.getState().project!).drums, false);
});
