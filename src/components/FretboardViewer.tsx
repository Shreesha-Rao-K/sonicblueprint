// Interactive Multi-Instrument Vector SVG Fretboard Viewer
// Supports 6-string guitar & 4/5-string bass, CAGED shape carousel, playable fingering selection, and strum audition.
"use client";

import { useState, useMemo } from "react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import {
  type InstrumentId,
  type ChordFingering,
  INSTRUMENT_TUNINGS,
  calculateFretX,
  findPlayableFingerings,
  getFretNote,
} from "@/lib/fretboard-engine";
import { parseChord } from "@/lib/music-theory";
import { getEngine } from "@/lib/audio-engine";
import { Card, SectionTitle, Button } from "./ui";
import { Play, Volume2, ChevronLeft, ChevronRight, Sliders } from "lucide-react";
import { cn } from "@/lib/cn";
import { announce } from "@/lib/a11y-announcer";

export interface FretboardViewerProps {
  className?: string | undefined;
  defaultInstrument?: InstrumentId | undefined;
}

export function FretboardViewer({
  className,
  defaultInstrument = "guitar-standard",
}: FretboardViewerProps) {
  const project = useProjectStore((s) => s.project);
  const chordIndex = useTransportStore((s) => s.chordIndex);
  const playing = useTransportStore((s) => s.playing);

  const [instrumentId, setInstrumentId] = useState<InstrumentId>(defaultInstrument);
  const [selectedFingeringIdx, setSelectedFingeringIdx] = useState<number>(0);
  const [displayMode, setDisplayMode] = useState<"fingering" | "all-notes">("fingering");

  const tuning = INSTRUMENT_TUNINGS[instrumentId];

  // Resolve active chord from project or transport
  const activeChord = useMemo(() => {
    if (!project || project.chords.chords.length === 0) return "C";
    const chords = project.chords.chords;
    const sym = chords[chordIndex % chords.length] ?? chords[0];
    return typeof sym === "string" ? sym : "C";
  }, [project, chordIndex]);

  const parsed = useMemo(() => parseChord(activeChord), [activeChord]);

  // Compute playable fingerings
  const fingerings = useMemo(() => {
    return findPlayableFingerings(activeChord, tuning, 15);
  }, [activeChord, tuning]);

  const activeFingering: ChordFingering | undefined =
    fingerings[selectedFingeringIdx % Math.max(1, fingerings.length)] ?? fingerings[0];

  const auditionNote = (midi: number) => {
    void getEngine().previewNote(midi, "piano");
  };

  const auditionStrum = () => {
    if (!activeFingering) return;
    const midis = activeFingering.midis;
    void getEngine().previewVoicingNotes(midis, "piano", 28);
  };

  if (!project) return null;

  // SVG Dimensions & Layout
  const totalFrets = 15;
  const svgWidth = 900;
  const svgHeight = 180;
  const nutWidth = 14;
  const nutX = 50; // space for string labels and nut indicators
  const fretboardWidth = svgWidth - nutX - 20;

  const numStrings = tuning.strings.length;
  const stringY = (stringIndex: number) => {
    // String 0 (lowest pitch) rendered at the bottom, or at top?
    // Standard guitar tab: High string (string 5) at top, low string (string 0) at bottom.
    const padding = 24;
    const available = svgHeight - padding * 2;
    const step = available / (numStrings - 1);
    return padding + (numStrings - 1 - stringIndex) * step;
  };

  const fretMarkers = [3, 5, 7, 9, 12, 15];

  return (
    <Card className={cn("p-5 space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <SectionTitle>Fretboard & Chord Fingerings</SectionTitle>
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-black text-[var(--accent-primary)]">
              {activeChord}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {tuning.name}
            </span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">
              {playing ? "● live" : "○ paused"}
            </span>
          </div>
        </div>

        {/* Controls: Instrument select, mode toggle, strum */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={instrumentId}
            aria-label="Select instrument fretboard"
            onChange={(e) => {
              setInstrumentId(e.target.value as InstrumentId);
              setSelectedFingeringIdx(0);
            }}
            className="h-8 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 text-xs font-medium text-[var(--text-primary)]"
          >
            <option value="guitar-standard">Guitar (Standard)</option>
            <option value="guitar-drop-d">Guitar (Drop D)</option>
            <option value="bass-standard">Bass (4-String)</option>
            <option value="bass-5string">Bass (5-String)</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setDisplayMode(displayMode === "fingering" ? "all-notes" : "fingering")
            }
            className="h-8 text-xs gap-1"
          >
            <Sliders className="h-3 w-3" />
            {displayMode === "fingering" ? "Shape View" : "All Chord Notes"}
          </Button>

          <Button
            size="sm"
            onClick={auditionStrum}
            className="h-8 gap-1.5 text-xs font-semibold"
            title="Strum this chord voicing"
          >
            <Play className="h-3.5 w-3.5" /> Strum
          </Button>
        </div>
      </div>

      {/* Fingering Carousel / Shape Navigator */}
      {displayMode === "fingering" && fingerings.length > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-3 py-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--accent-primary)] font-mono">
              #{((selectedFingeringIdx % fingerings.length) + 1)} of {fingerings.length}
            </span>
            <span className="text-[var(--text-primary)] font-medium">
              {activeFingering?.name}
            </span>
            {activeFingering?.barreFret && (
              <span className="rounded bg-[var(--accent-secondary)]/20 px-1.5 py-0.2 text-[10px] font-bold text-[var(--accent-secondary)]">
                Barre {activeFingering.barreFret}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                setSelectedFingeringIdx((prev) =>
                  prev === 0 ? fingerings.length - 1 : prev - 1
                )
              }
              className="tactile-button grid h-6 w-6 place-items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:text-[var(--accent-primary)]"
              title="Previous shape"
              aria-label="Previous chord shape"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                setSelectedFingeringIdx((prev) => (prev + 1) % fingerings.length)
              }
              className="tactile-button grid h-6 w-6 place-items-center rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:text-[var(--accent-primary)]"
              title="Next shape"
              aria-label="Next chord shape"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* SVG Vector Fretboard */}
      <div className="relative overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] p-2 shadow-inner">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="h-44 w-full min-w-[760px]"
          role="region"
          aria-label="Interactive Fretboard Visualization"
        >
          {/* Fretboard background wood */}
          <rect
            x={nutX}
            y={12}
            width={fretboardWidth}
            height={svgHeight - 24}
            rx={4}
            fill="#1e1c18"
            stroke="#332c25"
            strokeWidth={1}
          />

          {/* Bone Nut */}
          <rect
            x={nutX - nutWidth}
            y={12}
            width={nutWidth}
            height={svgHeight - 24}
            rx={2}
            fill="#e2dfd2"
            stroke="#645e54"
            strokeWidth={1}
          />

          {/* Fret wires and inlays */}
          {Array.from({ length: totalFrets + 1 }, (_, f) => {
            if (f === 0) return null;
            const x = nutX + calculateFretX(f, totalFrets, fretboardWidth);
            const prevX =
              nutX + (f === 1 ? 0 : calculateFretX(f - 1, totalFrets, fretboardWidth));
            const midX = (prevX + x) / 2;

            return (
              <g key={`fret-${f}`}>
                {/* Fret wire */}
                <line
                  x1={x}
                  y1={12}
                  x2={x}
                  y2={svgHeight - 12}
                  stroke="#94a3b8"
                  strokeWidth={2}
                />
                {/* Fret number label */}
                <text
                  x={midX}
                  y={svgHeight - 2}
                  textAnchor="middle"
                  fill="#64748b"
                  className="font-mono text-[9px] font-bold"
                >
                  {f}
                </text>

                {/* Pearl Inlay Dots */}
                {fretMarkers.includes(f) && f !== 12 && (
                  <circle
                    cx={midX}
                    cy={svgHeight / 2}
                    r={4}
                    fill="#cbd5e1"
                    opacity={0.4}
                  />
                )}
                {f === 12 && (
                  <>
                    <circle
                      cx={midX}
                      cy={svgHeight / 2 - 20}
                      r={3.5}
                      fill="#cbd5e1"
                      opacity={0.5}
                    />
                    <circle
                      cx={midX}
                      cy={svgHeight / 2 + 20}
                      r={3.5}
                      fill="#cbd5e1"
                      opacity={0.5}
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* Strings with physical gauges */}
          {tuning.strings.map((_, sIdx) => {
            const y = stringY(sIdx);
            // Gauge thickness: lower string = thicker
            const gauge = 1.0 + sIdx * 0.55;

            return (
              <g key={`str-${sIdx}`}>
                <line
                  x1={nutX - nutWidth}
                  y1={y}
                  x2={nutX + fretboardWidth}
                  y2={y}
                  stroke="#cbd5e1"
                  strokeWidth={gauge}
                  opacity={0.75}
                />
                {/* String tuning name at the nut headstock */}
                <text
                  x={nutX - nutWidth - 14}
                  y={y + 3.5}
                  textAnchor="middle"
                  fill="#94a3b8"
                  className="font-mono text-[10px] font-bold"
                >
                  {tuning.stringNames[sIdx]}
                </text>
              </g>
            );
          })}

          {/* Barre Line Indicator */}
          {displayMode === "fingering" &&
            activeFingering?.barreFret &&
            activeFingering.barreFret > 0 && (
              <g>
                {(() => {
                  const bF = activeFingering.barreFret;
                  const prevX =
                    nutX + (bF === 1 ? 0 : calculateFretX(bF - 1, totalFrets, fretboardWidth));
                  const curX = nutX + calculateFretX(bF, totalFrets, fretboardWidth);
                  const x = (prevX + curX) / 2;
                  const startY = stringY(0);
                  const endY = stringY(numStrings - 1);
                  return (
                    <line
                      x1={x}
                      y1={Math.min(startY, endY)}
                      x2={x}
                      y2={Math.max(startY, endY)}
                      stroke="var(--accent-secondary, #bc13fe)"
                      strokeWidth={18}
                      strokeLinecap="round"
                      opacity={0.35}
                    />
                  );
                })()}
              </g>
            )}

          {/* Nut Indicators: Open O or Muted X for fingering mode */}
          {displayMode === "fingering" &&
            activeFingering &&
            activeFingering.frets.map((fr, sIdx) => {
              const y = stringY(sIdx);
              const x = nutX - nutWidth / 2;
              if (fr === "x") {
                return (
                  <text
                    key={`mute-${sIdx}`}
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    fill="#ef4444"
                    className="font-mono text-[11px] font-black"
                  >
                    ✕
                  </text>
                );
              }
              if (fr === 0) {
                const note = getFretNote(sIdx, 0, tuning, parsed.rootPc, parsed.quality);
                return (
                  <g
                    key={`open-${sIdx}`}
                    onClick={() => {
                      auditionNote(note.midi);
                      announce(`${note.noteName} open string, ${note.intervalLabel}`);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        auditionNote(note.midi);
                        announce(`${note.noteName} open string, ${note.intervalLabel}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${note.noteName} open string (${note.intervalLabel})`}
                    className="cursor-pointer focus:outline-none [&:focus-visible>circle]:stroke-[var(--border-focus)] [&:focus-visible>circle]:stroke-[3px]"
                  >
                    <circle
                      cx={x}
                      cy={y}
                      r={7}
                      fill={note.isRoot ? "#f59e0b" : "var(--accent-primary)"}
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={x}
                      y={y + 3}
                      textAnchor="middle"
                      fill="#000000"
                      className="font-mono text-[8px] font-black"
                    >
                      {note.intervalLabel}
                    </text>
                  </g>
                );
              }
              return null;
            })}

          {/* Fret Notes in Fingering Mode */}
          {displayMode === "fingering" &&
            activeFingering &&
            activeFingering.frets.map((fr, sIdx) => {
              if (typeof fr !== "number" || fr <= 0) return null;
              const y = stringY(sIdx);
              const prevX =
                nutX + (fr === 1 ? 0 : calculateFretX(fr - 1, totalFrets, fretboardWidth));
              const curX = nutX + calculateFretX(fr, totalFrets, fretboardWidth);
              const x = (prevX + curX) / 2;
              const note = getFretNote(sIdx, fr, tuning, parsed.rootPc, parsed.quality);

              return (
                <g
                  key={`dot-${sIdx}-${fr}`}
                  onClick={() => {
                    auditionNote(note.midi);
                    announce(`${note.noteName} fret ${fr}, ${note.intervalLabel}`);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      auditionNote(note.midi);
                      announce(`${note.noteName} fret ${fr}, ${note.intervalLabel}`);
                    }
                  }}
                  className="cursor-pointer transition-transform hover:scale-110 active:scale-95 focus:outline-none [&:focus-visible>circle]:stroke-[var(--border-focus)] [&:focus-visible>circle]:stroke-[3px]"
                  role="button"
                  tabIndex={0}
                  aria-label={`${note.noteName} (Fret ${fr}, ${note.intervalLabel})`}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={10.5}
                    fill={note.isRoot ? "#f59e0b" : note.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    style={{
                      filter: note.isRoot
                        ? "drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))"
                        : "drop-shadow(0 0 6px rgba(0, 243, 255, 0.6))",
                    }}
                  />
                  <text
                    x={x}
                    y={y + 3.5}
                    textAnchor="middle"
                    fill={note.isRoot ? "#000000" : "#ffffff"}
                    className="font-mono text-[9px] font-black"
                  >
                    {note.intervalLabel}
                  </text>
                </g>
              );
            })}

          {/* All-Notes Mode: display all chord pitch classes across the neck */}
          {displayMode === "all-notes" &&
            tuning.strings.map((_, sIdx) => {
              const dots = [];
              for (let f = 0; f <= totalFrets; f++) {
                const note = getFretNote(sIdx, f, tuning, parsed.rootPc, parsed.quality);
                // Check if note is part of the chord
                const isChordTone = note.role !== "sus" && note.role !== "altered";
                if (isChordTone) {
                  const y = stringY(sIdx);
                  const prevX =
                    nutX + (f === 1 ? 0 : calculateFretX(Math.max(0, f - 1), totalFrets, fretboardWidth));
                  const curX = nutX + calculateFretX(f, totalFrets, fretboardWidth);
                  const x = f === 0 ? nutX - nutWidth / 2 : (prevX + curX) / 2;

                  dots.push(
                    <g
                      key={`all-${sIdx}-${f}`}
                      onClick={() => {
                        auditionNote(note.midi);
                        announce(`${note.noteName} fret ${f}, ${note.intervalLabel}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          auditionNote(note.midi);
                          announce(`${note.noteName} fret ${f}, ${note.intervalLabel}`);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`${note.noteName} (Fret ${f}, ${note.intervalLabel})`}
                      className="cursor-pointer hover:opacity-90 focus:outline-none [&:focus-visible>circle]:stroke-[var(--border-focus)] [&:focus-visible>circle]:stroke-[3px]"
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={note.isRoot ? 9 : 7}
                        fill={note.isRoot ? "#f59e0b" : note.color}
                        stroke="#ffffff"
                        strokeWidth={1}
                        opacity={note.isRoot ? 1 : 0.85}
                      />
                      <text
                        x={x}
                        y={y + 3}
                        textAnchor="middle"
                        fill={note.isRoot ? "#000000" : "#ffffff"}
                        className="font-mono text-[8px] font-black"
                      >
                        {note.intervalLabel}
                      </text>
                    </g>
                  );
                }
              }
              return dots;
            })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-secondary)]">
        <span className="flex items-center gap-1.5">
          <Volume2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          Click any fret dot to hear that note. Strum button plays chord voicing.
        </span>
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#f59e0b]" /> R (Root)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#10b981]" /> 3 (Third)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#06b6d4]" /> 5 (Fifth)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[#ec4899]" /> 7 (Seventh)
          </span>
        </div>
      </div>
    </Card>
  );
}
