// MIDI export — meaningful musical data: chords, bass, drums, melody, tempo, time sig.
// The MIDI library loads on demand so exporting never slows down opening the studio.
// Chord progression follows the accumulated arrangement position (see timing.ts),
// so MIDI matches playback: a VERSE after a 4-bar INTRO continues the
// progression instead of restarting it.
import type { SonicProject } from "./project-schema";
import { getLayers } from "./project-schema";
import { chordMidiNotes, generateMelody, rootToPc } from "./music-theory";
import { MELODY_STYLES } from "@/data/styles";
import {
  beatSecOf,
  chordSlots,
  normalizeBpm,
  normalizedBeatsPerChord,
  quarterBeatsOf,
} from "./timing";

export async function exportMidi(p: SonicProject): Promise<Blob> {
  const { Midi } = await import("@tonejs/midi");
  const layers = getLayers(p);
  const midi = new Midi();
  const bpm = normalizeBpm(p.config?.bpm);
  midi.header.setTempo(bpm);
  const [num, den] = String(p.config.timeSignature ?? "4/4").split("/").map(Number);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [num || 4, den || 4] as unknown as [number, number], measures: 0 });
  midi.header.update();

  const spq = beatSecOf(p);
  const qpb = quarterBeatsOf(p.config?.timeSignature ?? "4/4");
  const tonicPc = rootToPc(p.config.keyTonic);
  const scaleKind = p.config.scale === "major" ? "major" : "minor";
  const density = MELODY_STYLES.find((m) => m.id === p.melodyStyle)?.density ?? 0.6;

  const chordsTrack = midi.addTrack();
  chordsTrack.name = "Chords";
  chordsTrack.instrument.number = 0;
  const bassTrack = midi.addTrack();
  bassTrack.name = "Bass";
  bassTrack.instrument.number = 38;
  const drumsTrack = midi.addTrack();
  drumsTrack.name = "Drums";
  drumsTrack.channel = 9;
  const melodyTrack = midi.addTrack();
  melodyTrack.name = "Melody";
  melodyTrack.instrument.number = 46;

  const DRUM_MAP: Record<string, number> = {
    kick: 36, snare: 38, hihat: 42, openhat: 46, clap: 39, perc: 56, tom: 45, shaker: 70,
  };

  const beatsPerChordQ = normalizedBeatsPerChord(p);
  // Chord/bass/melody follow the shared accumulated-position timeline so MIDI
  // matches playback exactly (see timing.chordSlots). Drums stay per-bar.
  for (const slot of chordSlots(p)) {
    const start = slot.slotQ * spq;
    const dur = beatsPerChordQ * spq;
    const sym = slot.symbol;
    const idx = slot.chordIdx;
    const secIdx = slot.sectionIdx;
    if (layers.chords) {
      for (const m of chordMidiNotes(sym, p.chords.octave)) {
        chordsTrack.addNote({ midi: m, time: start, duration: dur * 0.95, velocity: 0.7 });
      }
    }
    if (layers.bass) {
      const root = chordMidiNotes(sym, 1)[0] - 12 + p.bass.octave * 12;
      bassTrack.addNote({ midi: root, time: start, duration: Math.min(dur * 0.95, spq * 2), velocity: 0.85 });
    }
    // melody slice (same seed scheme as playback: seed:section:chordIdx)
    if (layers.melody) {
      const mel = generateMelody([sym], beatsPerChordQ, tonicPc, scaleKind, `${p.originality.melodySeed}:${secIdx}:${idx}`, density);
      for (const n of mel) {
        melodyTrack.addNote({ midi: n.midi, time: start + n.startBeat * spq, duration: n.durBeats * spq * 0.9, velocity: 0.65 });
      }
    }
  }
  // drums (per bar, absolute timeline)
  {
    const sections = (Array.isArray(p.arrangement) ? p.arrangement : []).slice(0, 128);
    const steps = Number.isFinite(p.drums?.steps)
      ? Math.max(1, Math.min(64, Math.round(p.drums.steps as number)))
      : 16;
    const barDur = qpb * spq;
    const stepDur = barDur / steps;
    let absBar = 0;
    sections.forEach((sec) => {
      const secBars = Number.isFinite(sec?.bars) ? Math.max(1, Math.min(64, Math.round(sec.bars))) : 4;
      for (let bar = 0; bar < secBars; bar++) {
        const barStart = absBar * barDur;
        if (layers.drums) {
          for (let s = 0; s < steps; s++) {
            const tt = barStart + s * stepDur;
            for (const row of Object.keys(p.drums.grid) as (keyof typeof p.drums.grid)[]) {
              const col = p.drums.grid[row];
              if (col[s % col.length] && DRUM_MAP[row] !== undefined) {
                drumsTrack.addNote({ midi: DRUM_MAP[row], time: tt, duration: 0.12, velocity: 0.85 });
              }
            }
          }
        }
        absBar++;
      }
    });
  }

  const bytes = midi.toArray();
  const ab = new Uint8Array(bytes).buffer as ArrayBuffer;
  return new Blob([ab], { type: "audio/midi" });
}

export function midiFilename(projectName: string): string {
  const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
  return `SonicBlueprint_${safe}.mid`;
}
