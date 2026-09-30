// Piano-roll style preview: active chord highlighting + keyboard strip.
"use client";

import { useMemo } from "react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { chordMidiNotes } from "@/lib/music-theory";
import { Card, SectionTitle } from "./ui";
import { cn } from "@/lib/cn";

export function PianoPreview() {
  const project = useProjectStore((s) => s.project);
  const chordIndex = useTransportStore((s) => s.chordIndex);
  const playing = useTransportStore((s) => s.playing);

  const activeMidis = useMemo(() => {
    if (!project || project.chords.chords.length === 0) return new Set<number>();
    const sym = project.chords.chords[chordIndex % project.chords.chords.length] ?? project.chords.chords[0];
    if (typeof sym !== "string") return new Set<number>();
    return new Set(chordMidiNotes(sym, project.chords.octave).map((m) => ((m % 12) + 12) % 12));
  }, [project, chordIndex]);

  if (!project) return null;

  // two octaves of keys starting at C
  const keys: { pc: number; black: boolean }[] = [];
  for (let oct = 0; oct < 2; oct++) {
    for (let pc = 0; pc < 12; pc++) {
      keys.push({ pc, black: [1, 3, 6, 8, 10].includes(pc) });
    }
  }

  return (
    <Card className="p-5">
      <SectionTitle right={<span className="font-mono text-[11px] text-slate-400" title="Blue keys show the notes of the chord playing right now">{playing ? "● playing" : "○ paused"}</span>}>
        Chord Preview
      </SectionTitle>
      <div className="relative flex h-28 select-none overflow-hidden rounded-lg border border-[#22305c] bg-black/50" aria-hidden="true">
        {keys.map((k, i) => {
          const active = activeMidis.has(k.pc);
          return k.black ? (
            <div
              key={i}
              className={cn("relative z-10 -mx-[9px] h-16 w-[18px] shrink-0 rounded-b border", active ? "border-[#a78bfa] bg-[#a78bfa]" : "border-black bg-[#151a2e]")}
            />
          ) : (
            <div
              key={i}
              className={cn("h-full flex-1 rounded-b-sm border-r border-[#1c2547]", active ? "bg-[#6e8bff]/70 shadow-[0_0_18px_rgba(110,139,255,0.6)]" : "bg-[#e8ebf5]/95")}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-slate-400">
        Blue keys show the notes of the chord playing right now. Tap any chord above to hear it on its own.
      </p>
    </Card>
  );
}
