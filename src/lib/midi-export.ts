// MIDI export — meaningful musical data: chords, bass, drums, melody, tempo, time sig.
// The MIDI library loads on demand so exporting never slows down opening the studio.
import type { SonicProject } from "./project-schema";
import { chordMidiNotes, generateMelody, rootToPc } from "./music-theory";
import { MELODY_STYLES } from "@/data/styles";
import { quarterBeatsPerBar } from "./audio-engine";

export async function exportMidi(p: SonicProject): Promise<Blob> {
  const { Midi } = await import("@tonejs/midi");
  const midi = new Midi();
  midi.header.setTempo(Number.isFinite(p.config.bpm) ? p.config.bpm : 100);
  const [num, den] = String(p.config.timeSignature ?? "4/4").split("/").map(Number);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [num || 4, den || 4] as unknown as [number, number], measures: 0 });
  midi.header.update();

  const spq = 60 / p.config.bpm;
  const qpb = quarterBeatsPerBar(p.config.timeSignature);
  const tonicPc = rootToPc(p.config.keyTonic);
  const scaleKind = p.config.scale === "major" ? "major" : "minor";
  const density = MELODY_STYLES.find((m) => m.id === p.melodyStyle)?.density ?? 0.6;
  const chords = p.chords.chords.length ? p.chords.chords : ["Am"];

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

  let t = 0;
  const beatsPerChordQ = Math.max(1, p.chords.beatsPerChord);
  p.arrangement.forEach((sec, secIdx) => {
    for (let bar = 0; bar < sec.bars; bar++) {
      const barStart = t + bar * qpb * spq;
      const chordsInBar = Math.max(1, Math.round(qpb / beatsPerChordQ));
      for (let c = 0; c < chordsInBar; c++) {
        const start = barStart + c * beatsPerChordQ * spq;
        const dur = beatsPerChordQ * spq;
        const ci = Math.floor((bar * qpb + c * beatsPerChordQ) / beatsPerChordQ + secIdx * 0) % chords.length;
        const idx = ((ci % chords.length) + chords.length) % chords.length;
        const sym = chords[idx];
        for (const m of chordMidiNotes(sym, p.chords.octave)) {
          chordsTrack.addNote({ midi: m, time: start, duration: dur * 0.95, velocity: 0.7 });
        }
        const root = chordMidiNotes(sym, 1)[0] - 12 + p.bass.octave * 12;
        bassTrack.addNote({ midi: root, time: start, duration: Math.min(dur * 0.95, spq * 2), velocity: 0.85 });
        // melody slice
        const mel = generateMelody([sym], beatsPerChordQ, tonicPc, scaleKind, `${p.originality.melodySeed}:${secIdx}:${idx}`, density);
        for (const n of mel) {
          melodyTrack.addNote({ midi: n.midi, time: start + n.startBeat * spq, duration: n.durBeats * spq * 0.9, velocity: 0.65 });
        }
      }
      // drums
      const steps = p.drums.steps;
      const barDur = qpb * spq;
      const stepDur = barDur / steps;
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
    t += sec.bars * qpb * spq;
  });

  const bytes = midi.toArray();
  const ab = new Uint8Array(bytes).buffer as ArrayBuffer;
  return new Blob([ab], { type: "audio/midi" });
}

export function midiFilename(projectName: string): string {
  const safe = projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
  return `SonicBlueprint_${safe}.mid`;
}
