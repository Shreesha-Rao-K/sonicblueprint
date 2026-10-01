// Unit tests: audio startup failure handling (UI-facing states, engine guards).
// Node has no Web Audio, which doubles as the "unavailable/blocked" case.
import { suite, test, eq, ok } from "./helpers";
import {
  AudioStartError,
  WebAudioEngine,
  describeAudioError,
} from "@/lib/audio-engine";
import { createProject } from "@/lib/project-schema";

suite("audio failure copy");

test("each failure kind has friendly, non-technical copy", () => {
  for (const kind of ["unavailable", "blocked", "failed"] as const) {
    const msg = describeAudioError(new AudioStartError(kind));
    ok(msg.includes("song is safe"), kind);
    ok(!msg.includes("AudioContext") && !msg.includes("stack"), `${kind} hides internals`);
  }
});

test("unknown errors map to the generic message", () => {
  const msg = describeAudioError(new Error("boom"));
  ok(msg.includes("song is safe"), "generic");
  ok(msg.includes("try again"), "retry hint");
});

suite("engine startup guards");

test("play without Web Audio rejects unavailable and starts nothing", async () => {
  const eng = new WebAudioEngine();
  let kind: string | null = null;
  try {
    await eng.play(createProject("Silent"));
  } catch (e) {
    kind = e instanceof AudioStartError ? e.kind : `wrong:${String(e)}`;
  }
  eq(kind, "unavailable");
  eq(eng.isPlaying(), false);
  eng.stop();
  eq(eng.isPlaying(), false);
});

test("rapid double play leaves no ghost timer", async () => {
  const eng = new WebAudioEngine();
  const p = createProject("Tap");
  const results = await Promise.allSettled([eng.play(p), eng.play(p)]);
  eq(results.filter((r) => r.status === "rejected").length, 2);
  eq(eng.isPlaying(), false);
  eng.stop();
});

test("resume with nothing loaded is a silent no-op", async () => {
  const eng = new WebAudioEngine();
  await eng.resume();
  ok(true, "resolved");
});

test("previews never reject without Web Audio", async () => {
  const eng = new WebAudioEngine();
  await eng.previewChord("Am", 3);
  await eng.previewDrums(createProject("Quiet"));
  ok(true, "resolved");
});

test("stop is always safe, even before any start", () => {
  const eng = new WebAudioEngine();
  eng.stop();
  eng.stop(false);
  eq(eng.isPlaying(), false);
  eq(eng.position(), 0);
});

test("failed start leaves project data untouched for export", async () => {
  const eng = new WebAudioEngine();
  const p = createProject("Keep");
  try {
    await eng.play(p);
  } catch {
    /* expected */
  }
  eq(p.config.bpm, 100);
  eq(p.chords.chords, ["Dm", "Bb", "F", "C"]);
});
