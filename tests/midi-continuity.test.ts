// V3.1 hardening: MIDI cross-section chord continuity.
// MIDI export must produce the same chord progression as playback
// (buildSongEvents), not restart per section. Tests verify actual chord MIDI
// pitches, not merely that a file was generated.
import { suite, test, eq, ok } from "./helpers";
import { buildSongEvents } from "@/lib/audio-engine";
import { chordMidiNotes } from "@/lib/music-theory";
import { exportMidi } from "@/lib/midi-export";
import { createProject, type SonicProject } from "@/lib/project-schema";

function testProject(chords: string[], bars: number[]): SonicProject {
  const base = createProject("Continuity");
  return {
    ...base,
    config: { ...base.config, humanize: "off" },
    chords: { ...base.chords, chords, beatsPerChord: 4 },
    arrangement: bars.map((b, i) => ({
      id: `s${i}`, name: `SEC${i}`, bars: b, energy: 6, instruments: [],
    })),
  };
}

interface DecodedTrack {
  name?: string;
  notes: { midi: number; time: number }[];
}

async function decodeTracks(p: SonicProject): Promise<DecodedTrack[]> {
  const { Midi } = await import("@tonejs/midi");
  const bytes = new Uint8Array(await (await exportMidi(p)).arrayBuffer());
  const m = new Midi(bytes);
  return m.tracks as unknown as DecodedTrack[];
}

function trackByName(tracks: DecodedTrack[], name: string): DecodedTrack {
  const t = tracks.find((t) => t.name === name);
  if (!t) throw new Error(`missing MIDI track "${name}"`);
  return t;
}

/** Root pitch classes of the bass line in time order (one note per slot). */
function bassRoots(bass: DecodedTrack): number[] {
  return [...bass.notes]
    .sort((a, b) => a.time - b.time)
    .map((n) => ((Math.round(n.midi) % 12) + 12) % 12);
}

const pc = (sym: string): number =>
  ((chordMidiNotes(sym, 1)[0] % 12) + 12) % 12;

suite("midi cross-section continuity");

test("single section renders its progression in order", async () => {
  const chords = ["C", "G", "Am", "F"];
  const tracks = await decodeTracks(testProject(chords, [4]));
  eq(bassRoots(trackByName(tracks, "Bass")), chords.map(pc));
});

test("two sections continue instead of restarting", async () => {
  const chords = ["C", "Dm", "Em", "F", "G", "Am", "Bb", "C"];
  const tracks = await decodeTracks(testProject(chords, [4, 4]));
  eq(bassRoots(trackByName(tracks, "Bass")), chords.map(pc));
});

test("multiple sections with different bar counts stay continuous", async () => {
  const chords = ["C", "D", "E", "F", "G", "A"];
  const tracks = await decodeTracks(testProject(chords, [2, 4, 2]));
  eq(
    bassRoots(trackByName(tracks, "Bass")),
    ["C", "D", "E", "F", "G", "A", "C", "D"].map(pc)
  );
});

test("progression wraps around the chord list", async () => {
  const tracks = await decodeTracks(testProject(["C", "G"], [4]));
  eq(bassRoots(trackByName(tracks, "Bass")), ["C", "G", "C", "G"].map(pc));
});

test("chord track carries the same symbols in the same order", async () => {
  const chords = ["C", "Dm", "Em", "F", "G", "Am"];
  const tracks = await decodeTracks(testProject(chords, [2, 4]));
  const chordTrack = trackByName(tracks, "Chords");
  const byStart = new Map<number, number[]>();
  for (const n of chordTrack.notes) {
    const key = Math.round(n.time * 1000);
    const arr = byStart.get(key);
    if (arr) arr.push(Math.round(n.midi));
    else byStart.set(key, [Math.round(n.midi)]);
  }
  const starts = [...byStart.keys()].sort((a, b) => a - b);
  eq(starts.length, 6);
  const want = ["C", "Dm", "Em", "F", "G", "Am"];
  starts.forEach((t, i) => {
    const got = new Set(byStart.get(t)!.map((m) => ((m % 12) + 12) % 12));
    const exp = new Set(chordMidiNotes(want[i], 3).map((m) => ((m % 12) + 12) % 12));
    eq([...got].sort(), [...exp].sort(), `slot ${i} (${want[i]})`);
  });
});

test("export matches buildSongEvents chord order", async () => {
  const chords = ["Dm", "Bb", "F", "C", "Gm", "Eb"];
  const p = testProject(chords, [3, 3]);
  const tracks = await decodeTracks(p);
  const midiRoots = bassRoots(trackByName(tracks, "Bass"));
  // Playback bass roots at each chord slot (humanize off: exact timing).
  const song = buildSongEvents(p);
  const bass = song.notes
    .filter((n) => n.synth === "bass")
    .sort((a, b) => a.time - b.time);
  // First bass note of each chord slot: group by start time.
  const slots = new Map<number, number>();
  for (const n of bass) {
    const key = Math.round(n.time * 1000);
    if (!slots.has(key)) slots.set(key, ((Math.round(n.midi) % 12) + 12) % 12);
  }
  const playRoots = [...slots.keys()].sort((a, b) => a - b).map((k) => slots.get(k)!);
  eq(midiRoots, playRoots);
  eq(midiRoots, ["Dm", "Bb", "F", "C", "Gm", "Eb"].map(pc));
});

suite("midi timing safety");

test("malformed BPM still exports a valid, finite file", async () => {
  const base = createProject("BadBpm");
  const p: SonicProject = {
    ...base,
    config: { ...base.config, bpm: 0 as never },
    arrangement: [{ id: "s", name: "VERSE", bars: 2, energy: 6, instruments: [] }],
  };
  const tracks = await decodeTracks(p);
  let count = 0;
  for (const t of tracks) {
    for (const n of t.notes) {
      ok(Number.isFinite(n.time) && n.time >= 0, "finite note time");
      count++;
    }
  }
  ok(count > 0, "has notes");
});
