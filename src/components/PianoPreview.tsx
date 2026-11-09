// Interactive Multi-Octave SVG Piano Keyboard
// Displays exact chord registers, inversions, interval badges, root aura, and click auditioning.
"use client";

import { useMemo, useState, useRef } from "react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import {
  chordMidiNotes,
  parseChord,
  midiToFreq,
  getIntervalDetails,
  pcToName,
} from "@/lib/music-theory";
import { getEngine } from "@/lib/audio-engine";
import { Card, SectionTitle } from "./ui";
import { Volume2 } from "lucide-react";
import { announce } from "@/lib/a11y-announcer";

interface PianoKey {
  midi: number;
  pitchClass: number;
  octave: number;
  isBlack: boolean;
  name: string;
  whiteIndex: number; // Index among white keys (for X layout)
}

export function PianoPreview() {
  const project = useProjectStore((s) => s.project);
  const chordIndex = useTransportStore((s) => s.chordIndex);
  const playing = useTransportStore((s) => s.playing);
  const svgRef = useRef<SVGSVGElement>(null);
  const [focusedMidi, setFocusedMidi] = useState<number>(48);

  // Derive active chord symbol and notes
  const activeChord = useMemo(() => {
    if (!project || project.chords.chords.length === 0) return null;
    const chords = project.chords.chords;
    const sym = chords[chordIndex % chords.length] ?? chords[0];
    return typeof sym === "string" ? sym : null;
  }, [project, chordIndex]);

  const parsedChord = useMemo(() => {
    return activeChord ? parseChord(activeChord) : null;
  }, [activeChord]);

  const activeMidis = useMemo(() => {
    if (!project || !activeChord) return new Set<number>();
    const midis = chordMidiNotes(
      activeChord,
      project.chords.octave,
      project.chords.voicing ?? "root"
    );
    return new Set(midis);
  }, [project, activeChord]);

  // Construct 3 octaves: C3 (MIDI 48) to B5 (MIDI 83), plus C6 (MIDI 84) -> 37 keys
  const startMidi = 48; // C3
  const totalKeys = 37;

  const { whiteKeys, blackKeys } = useMemo(() => {
    const whites: PianoKey[] = [];
    const blacks: PianoKey[] = [];
    let wCount = 0;

    for (let m = startMidi; m < startMidi + totalKeys; m++) {
      const pc = ((m % 12) + 12) % 12;
      const isBlack = [1, 3, 6, 8, 10].includes(pc);
      const oct = Math.floor(m / 12) - 1;
      const name = pcToName(pc, true) + oct;

      if (!isBlack) {
        const key: PianoKey = {
          midi: m,
          pitchClass: pc,
          octave: oct,
          isBlack: false,
          name,
          whiteIndex: wCount,
        };
        whites.push(key);
        wCount++;
      } else {
        // Black key associates with previous white key position
        const key: PianoKey = {
          midi: m,
          pitchClass: pc,
          octave: oct,
          isBlack: true,
          name,
          whiteIndex: wCount - 1,
        };
        blacks.push(key);
      }
    }
    return { whiteKeys: whites, blackKeys: blacks };
  }, []);

  const auditionKey = (midi: number) => {
    void getEngine().previewNote(midi, "piano");
  };

  const onKeyKeyDown = (e: React.KeyboardEvent, midi: number, name: string) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = Math.min(startMidi + totalKeys - 1, midi + 1);
      setFocusedMidi(next);
      svgRef.current?.querySelector<SVGElement>(`[data-midi="${next}"]`)?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      const prev = Math.max(startMidi, midi - 1);
      setFocusedMidi(prev);
      svgRef.current?.querySelector<SVGElement>(`[data-midi="${prev}"]`)?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      setFocusedMidi(startMidi);
      svgRef.current?.querySelector<SVGElement>(`[data-midi="${startMidi}"]`)?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      const last = startMidi + totalKeys - 1;
      setFocusedMidi(last);
      svgRef.current?.querySelector<SVGElement>(`[data-midi="${last}"]`)?.focus();
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      auditionKey(midi);
      announce(`${name}, ${Math.round(midiToFreq(midi))} Hertz`);
    }
  };

  if (!project) return null;

  // SVG Geometry
  const whiteW = 32;
  const whiteH = 120;
  const blackW = 20;
  const blackH = 76;
  const totalWidth = whiteKeys.length * whiteW;
  const totalHeight = whiteH;

  // Helper to determine interval label and color for an active note
  const getNoteBadge = (midi: number) => {
    if (!parsedChord || !activeMidis.has(midi)) return null;
    const pc = ((midi % 12) + 12) % 12;
    const diff = ((pc - parsedChord.rootPc) % 12 + 12) % 12;
    const isRoot = diff === 0;
    const details = getIntervalDetails(diff, parsedChord.quality);
    return {
      label: details.label,
      color: details.color,
      isRoot,
    };
  };

  return (
    <Card className="p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
            {activeChord && (
              <span className="font-bold text-[var(--accent-primary)]">
                {activeChord} ({project.chords.voicing ?? "root"})
              </span>
            )}
            <span>{playing ? "● playing" : "○ paused"}</span>
          </div>
        }
      >
        Piano Roll Voicing Keyboard
      </SectionTitle>

      <div className="relative mt-2 select-none overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] p-2 shadow-inner">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="h-32 w-full min-w-[680px]"
          style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.5))" }}
          role="region"
          aria-label="Interactive Chord Piano Keyboard"
        >
          {/* White keys */}
          {whiteKeys.map((k) => {
            const active = activeMidis.has(k.midi);
            const badge = getNoteBadge(k.midi);
            const x = k.whiteIndex * whiteW;

            return (
              <g
                key={k.midi}
                data-midi={k.midi}
                onClick={() => {
                  auditionKey(k.midi);
                  announce(`${k.name}, ${Math.round(midiToFreq(k.midi))} Hertz`);
                }}
                onFocus={() => setFocusedMidi(k.midi)}
                onKeyDown={(e) => onKeyKeyDown(e, k.midi, k.name)}
                className="cursor-pointer transition-transform hover:opacity-90 active:scale-y-[0.98] focus:outline-none [&:focus-visible>rect]:stroke-[var(--border-focus)] [&:focus-visible>rect]:stroke-[3px]"
                role="button"
                tabIndex={focusedMidi === k.midi ? 0 : -1}
                aria-label={`${k.name} (${Math.round(midiToFreq(k.midi))} Hz)`}
                aria-pressed={active}
              >
                <rect
                  x={x + 0.5}
                  y={0.5}
                  width={whiteW - 1}
                  height={whiteH - 1}
                  rx={4}
                  fill={
                    active
                      ? badge?.isRoot
                        ? "#f59e0b"
                        : "var(--accent-primary)"
                      : "#f1f5f9"
                  }
                  stroke={active ? "white" : "#cbd5e1"}
                  strokeWidth={active ? 2 : 1}
                  style={
                    active
                      ? {
                          filter: badge?.isRoot
                            ? "drop-shadow(0 0 10px rgba(245, 158, 11, 0.7))"
                            : "drop-shadow(0 0 10px rgba(0, 243, 255, 0.6))",
                        }
                      : undefined
                  }
                />

                {/* Octave marker at C */}
                {k.pitchClass === 0 && (
                  <text
                    x={x + whiteW / 2}
                    y={whiteH - 24}
                    textAnchor="middle"
                    className="font-mono text-[9px] font-bold"
                    fill={active ? "#090a0f" : "#64748b"}
                  >
                    {k.name}
                  </text>
                )}

                {/* Interval badge on active white key */}
                {active && badge && (
                  <g transform={`translate(${x + whiteW / 2}, ${whiteH - 12})`}>
                    <circle r={8} fill="#090a0f" opacity={0.85} />
                    <text
                      y={3}
                      textAnchor="middle"
                      fill={badge.isRoot ? "#f59e0b" : "#ffffff"}
                      className="font-mono text-[9px] font-black"
                    >
                      {badge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Black keys */}
          {blackKeys.map((k) => {
            const active = activeMidis.has(k.midi);
            const badge = getNoteBadge(k.midi);

            // Compute centered X position relative to adjacent white keys
            const pc = k.pitchClass;
            let offset = 0;
            if (pc === 1) offset = -2;      // C#
            else if (pc === 3) offset = 2;  // D#
            else if (pc === 6) offset = -3; // F#
            else if (pc === 8) offset = 0;  // G#
            else if (pc === 10) offset = 3; // A#

            const x = (k.whiteIndex + 1) * whiteW - blackW / 2 + offset;

            return (
              <g
                key={k.midi}
                data-midi={k.midi}
                onClick={(e) => {
                  e.stopPropagation();
                  auditionKey(k.midi);
                  announce(`${k.name}, ${Math.round(midiToFreq(k.midi))} Hertz`);
                }}
                onFocus={() => setFocusedMidi(k.midi)}
                onKeyDown={(e) => onKeyKeyDown(e, k.midi, k.name)}
                className="cursor-pointer transition-transform hover:opacity-90 active:scale-y-[0.98] focus:outline-none [&:focus-visible>rect]:stroke-[var(--border-focus)] [&:focus-visible>rect]:stroke-[3px]"
                role="button"
                tabIndex={focusedMidi === k.midi ? 0 : -1}
                aria-label={`${k.name} (${Math.round(midiToFreq(k.midi))} Hz)`}
                aria-pressed={active}
              >
                <rect
                  x={x}
                  y={0}
                  width={blackW}
                  height={blackH}
                  rx={3}
                  fill={
                    active
                      ? badge?.isRoot
                        ? "#f59e0b"
                        : "var(--accent-secondary, #bc13fe)"
                      : "#1e293b"
                  }
                  stroke={active ? "white" : "#090a0f"}
                  strokeWidth={active ? 1.5 : 1}
                  style={
                    active
                      ? {
                          filter: badge?.isRoot
                            ? "drop-shadow(0 0 10px rgba(245, 158, 11, 0.7))"
                            : "drop-shadow(0 0 10px rgba(188, 19, 254, 0.7))",
                        }
                      : undefined
                  }
                />

                {/* Interval badge on active black key */}
                {active && badge && (
                  <g transform={`translate(${x + blackW / 2}, ${blackH - 12})`}>
                    <circle r={7} fill="#090a0f" opacity={0.85} />
                    <text
                      y={2.5}
                      textAnchor="middle"
                      fill={badge.isRoot ? "#f59e0b" : "#ffffff"}
                      className="font-mono text-[8px] font-black"
                    >
                      {badge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          Click or tap any key to audition pitch.
        </span>
        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> Root (R)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)]" /> Chord Tone
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-secondary)]" /> Extension
          </span>
        </div>
      </div>
    </Card>
  );
}
