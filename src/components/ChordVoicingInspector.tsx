// Interactive Chord Voicing & Interval Inspector
// Visualizes note breakdown (Hz, MIDI, interval roles), inversions, Drop-2/Drop-3, and audition triggers.
"use client";

import { useMemo } from "react";
import {
  type ChordVoicing,
  CHORD_VOICINGS,
  getVoicingNotesMetadata,
  parseChord,
  qualitySuffix,
} from "@/lib/music-theory";
import { getEngine } from "@/lib/audio-engine";
import { Card, SectionTitle, Button } from "./ui";
import { Play, Volume2, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";

export interface ChordVoicingInspectorProps {
  symbol: string;
  octave?: number | undefined;
  voicing?: ChordVoicing | undefined;
  onChangeVoicing?: ((newVoicing: ChordVoicing) => void) | undefined;
  onChangeChord?: ((newSymbol: string) => void) | undefined;
  className?: string | undefined;
}

export function ChordVoicingInspector({
  symbol,
  octave = 3,
  voicing = "root",
  onChangeVoicing,
  onChangeChord,
  className,
}: ChordVoicingInspectorProps) {
  const parsed = useMemo(() => parseChord(symbol), [symbol]);
  const notesMeta = useMemo(
    () => getVoicingNotesMetadata(symbol, octave, voicing),
    [symbol, octave, voicing]
  );

  const auditionNote = (midi: number) => {
    void getEngine().previewNote(midi, "piano");
  };

  const auditionBlock = () => {
    const midis = notesMeta.map((n) => n.midi);
    void getEngine().previewVoicingNotes(midis, "piano", 0);
  };

  const auditionStrum = () => {
    const midis = notesMeta.map((n) => n.midi);
    void getEngine().previewVoicingNotes(midis, "piano", 28);
  };

  const auditionArp = () => {
    const midis = notesMeta.map((n) => n.midi);
    void getEngine().previewVoicingNotes(midis, "piano", 120);
  };

  const availableQualities = [
    { label: "Maj", suffix: "" },
    { label: "Min", suffix: "m" },
    { label: "7", suffix: "7" },
    { label: "Maj7", suffix: "maj7" },
    { label: "m7", suffix: "m7" },
    { label: "9", suffix: "9" },
    { label: "add9", suffix: "add9" },
    { label: "sus4", suffix: "sus4" },
    { label: "dim", suffix: "dim" },
  ];

  const changeQuality = (suffix: string) => {
    if (!onChangeChord) return;
    const baseRoot = parsed.root;
    const bass = parsed.bass ? `/${parsed.bass}` : "";
    onChangeChord(`${baseRoot}${suffix}${bass}`);
  };

  return (
    <Card className={cn("p-5 space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div>
          <SectionTitle>Harmonic Voicing & Theory</SectionTitle>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-[var(--accent-primary)] font-mono">
              {symbol}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              (Octave {octave})
            </span>
          </div>
        </div>

        {/* Audition Trigger Group */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={auditionStrum}
            className="h-8 gap-1 text-xs"
            title="Strum voicing (28ms stagger)"
          >
            <Play className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Strum
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={auditionBlock}
            className="h-8 gap-1 text-xs"
            title="Play all notes simultaneously"
          >
            <Volume2 className="h-3.5 w-3.5" /> Block
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={auditionArp}
            className="h-8 gap-1 text-xs"
            title="Arpeggiate upward (120ms interval)"
          >
            <Sparkles className="h-3.5 w-3.5" /> Arp
          </Button>
        </div>
      </div>

      {/* Voicing / Inversion Selector Pills */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Voicing Form & Inversion
          </span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {CHORD_VOICINGS.find((v) => v.id === voicing)?.label ?? "Root Position"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CHORD_VOICINGS.map((v) => {
            const isSelected = voicing === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onChangeVoicing?.(v.id)}
                className={cn(
                  "tactile-button rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  isSelected
                    ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] shadow-sm font-semibold"
                    : "border border-[var(--border-subtle)] bg-[var(--bg-input)] text-[var(--text-secondary)] hover:border-[var(--border-interactive)] hover:text-[var(--text-primary)]"
                )}
                title={v.description}
              >
                {v.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Note-by-Note Breakdown Grid */}
      <div>
        <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Sounding Voice Composition
        </span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {notesMeta.map((n, idx) => (
            <div
              key={`${n.midi}-${idx}`}
              className="flex flex-col justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] p-2.5 transition-all hover:border-[var(--border-focus)]"
            >
              <div className="flex items-center justify-between">
                <span
                  className="inline-flex h-5 items-center justify-center rounded px-1.5 text-[10px] font-black"
                  style={{
                    backgroundColor: `${n.interval.color}25`,
                    color: n.interval.color,
                    border: `1px solid ${n.interval.color}50`,
                  }}
                >
                  {n.interval.label}
                </span>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  MIDI {n.midi}
                </span>
              </div>

              <div className="my-2">
                <span className="text-base font-bold text-[var(--text-primary)]">
                  {n.noteName}
                </span>
                <span className="block font-mono text-[11px] text-[var(--text-secondary)]">
                  {n.freqHz.toFixed(1)} Hz
                </span>
              </div>

              <button
                type="button"
                onClick={() => auditionNote(n.midi)}
                className="tactile-button flex items-center justify-center gap-1 rounded bg-[var(--bg-surface)] py-1 text-[10px] font-medium text-[var(--text-secondary)] hover:text-[var(--accent-primary)]"
                title={`Hear ${n.noteName} (${n.freqHz} Hz)`}
              >
                <Volume2 className="h-3 w-3" /> Audition
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Extension & Quality Quick Modifiers */}
      {onChangeChord && (
        <div className="border-t border-[var(--border-subtle)] pt-3">
          <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
            Harmonic Quality Modifier
          </span>
          <div className="flex flex-wrap gap-1">
            {availableQualities.map((q) => {
              const currentSuffix = qualitySuffix(parsed.quality, symbol);
              const isActive = currentSuffix === q.suffix;
              return (
                <button
                  key={q.suffix}
                  type="button"
                  onClick={() => changeQuality(q.suffix)}
                  className={cn(
                    "tactile-button rounded px-2 py-0.5 text-xs font-mono transition-all",
                    isActive
                      ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-bold shadow-sm"
                      : "border border-[var(--border-subtle)] bg-[var(--bg-input)]/70 text-[var(--text-secondary)] hover:border-[var(--border-interactive)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
