// Visual step sequencer: interactive grid, presets, subdivisions, preview.
// Enhanced with 25ms transport loop sync, luminescent pad flash, GPU-accelerated translate3d playhead,
// 48px touch target ergonomics, sticky track headers, and swipe-to-paint gestures.
"use client";

import { useRef, useState, useEffect } from "react";
import { Play, Plus, Minus, Volume2 } from "lucide-react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { DRUM_PRESETS, DRUM_CATEGORIES } from "@/data/drums";
import type { DrumRow } from "@/lib/project-schema";
import { getEngine } from "@/lib/audio-engine";
import {
  calculateStepTiming,
  isPadTriggered,
  calculatePlayheadTranslate3d,
} from "@/lib/sequencer-kinetics";
import { Button, Card, Label, SectionTitle, Badge, Slider } from "./ui";
import { cn } from "@/lib/cn";
import { announceSequencer, announcePreset } from "@/lib/a11y-announcer";

const ROWS: { id: DrumRow; label: string; hint: string }[] = [
  { id: "kick", label: "KICK", hint: "Low thump on the beat — the heartbeat of the drums" },
  { id: "snare", label: "SNARE", hint: "Sharp crack, usually on beats 2 and 4" },
  { id: "hihat", label: "HI-HAT", hint: "Fast ticking that keeps time moving" },
  { id: "openhat", label: "OPEN HAT", hint: "Longer shimmering tick for lift" },
  { id: "clap", label: "CLAP", hint: "Hand-clap sound that makes choruses feel bigger" },
  { id: "perc", label: "PERC", hint: "Extra clicks and blips for flavor" },
  { id: "tom", label: "TOM", hint: "Deep round drum hits for fills and drama" },
  { id: "shaker", label: "SHAKER", hint: "Soft continuous rattle underneath everything" },
];

export function DrumSequencer() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const playing = useTransportStore((s) => s.playing);
  const positionSec = useTransportStore((s) => s.positionSec);

  const [cat, setCat] = useState<string>("all");
  // Roving tabindex: one Tab stop for the whole grid; arrows move within it.
  const [focusCell, setFocusCell] = useState({ r: 0, c: 0 });
  const [isPainting, setIsPainting] = useState<boolean | null>(null);
  const [gridWidthPx, setGridWidthPx] = useState<number>(600);
  const [gridLeftPx, setGridLeftPx] = useState<number>(120);

  const gridRef = useRef<HTMLDivElement>(null);
  const padsContainerRef = useRef<HTMLDivElement>(null);
  const padsGridRef = useRef<HTMLDivElement>(null);

  // Synchronous refs to prevent race conditions during 60Hz/120Hz drag gestures
  const isPaintingRef = useRef<boolean | null>(null);
  const paintRowRef = useRef<DrumRow | null>(null);
  const lastPaintedStepRef = useRef<{ row: DrumRow; step: number } | null>(null);

  // Measure active step pads matrix geometry (width and offset) for sub-pixel playhead tracking
  useEffect(() => {
    const measure = () => {
      if (padsGridRef.current) {
        setGridWidthPx(padsGridRef.current.clientWidth);
        setGridLeftPx(padsGridRef.current.offsetLeft || 120);
      }
    };
    measure();
    window.addEventListener("resize", measure);
    const ro = typeof ResizeObserver !== "undefined" && padsGridRef.current
      ? new ResizeObserver(measure)
      : null;
    if (ro && padsGridRef.current) {
      ro.observe(padsGridRef.current);
    }
    return () => {
      window.removeEventListener("resize", measure);
      ro?.disconnect();
    };
  }, [project?.drums?.steps]);

  // Global pointer release listener ensuring paint state resets if drag leaves card boundary
  useEffect(() => {
    if (isPainting === null) return;
    const handleGlobalPointerUp = () => {
      isPaintingRef.current = null;
      paintRowRef.current = null;
      lastPaintedStepRef.current = null;
      setIsPainting(null);
    };
    window.addEventListener("pointerup", handleGlobalPointerUp);
    window.addEventListener("pointercancel", handleGlobalPointerUp);
    return () => {
      window.removeEventListener("pointerup", handleGlobalPointerUp);
      window.removeEventListener("pointercancel", handleGlobalPointerUp);
    };
  }, [isPainting]);

  if (!project) return null;
  const drums = project.drums;

  // Derive step timing kinetics
  const timing = calculateStepTiming(
    positionSec,
    project.config.bpm,
    drums.steps,
    project.config.timeSignature
  );

  const playheadKinematics = calculatePlayheadTranslate3d(
    timing.barProgress,
    gridWidthPx
  );

  // Clamp the roving position so a preset with fewer steps never strands focus.
  const focusR = Math.max(0, Math.min(ROWS.length - 1, focusCell.r));
  const focusC = Math.max(0, Math.min(drums.steps - 1, focusCell.c));

  const focusCellAt = (r: number, c: number) => {
    const next = {
      r: Math.max(0, Math.min(ROWS.length - 1, r)),
      c: Math.max(0, Math.min(drums.steps - 1, c)),
    };
    setFocusCell(next);
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-cell="${next.r}-${next.c}"]`)
      ?.focus();
  };

  const onCellKeyDown = (e: React.KeyboardEvent, r: number, c: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); focusCellAt(r, c + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusCellAt(r, c - 1); }
    else if (e.key === "ArrowDown") { e.preventDefault(); focusCellAt(r + 1, c); }
    else if (e.key === "ArrowUp") { e.preventDefault(); focusCellAt(r - 1, c); }
    else if (e.key === "Home") { e.preventDefault(); focusCellAt(r, 0); }
    else if (e.key === "End") { e.preventDefault(); focusCellAt(r, drums.steps - 1); }
    else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const rowId = ROWS[r]?.id;
      if (rowId) {
        const rCycle = drums.rowCycles?.[rowId] ?? drums.steps;
        const currentVal = Boolean(drums.grid[rowId]?.[c % rCycle]);
        setCellState(rowId, c);
        announceSequencer(ROWS[r]?.label ?? rowId, c, !currentVal);
      }
    }
  };

  const setRowCycle = (row: DrumRow, cycle: number) => {
    update((p) => {
      const prevCycles = p.drums.rowCycles ?? {};
      const nextCycles = { ...prevCycles };
      if (cycle === p.drums.steps) {
        delete nextCycles[row];
      } else {
        nextCycles[row] = cycle;
      }
      return {
        ...p,
        drums: {
          ...p.drums,
          rowCycles: Object.keys(nextCycles).length > 0 ? nextCycles : undefined,
          patternId: "custom-polyrhythm",
        },
        originality: { ...p.originality, presetOnly: false },
      };
    });
  };

  const setCellState = (row: DrumRow, step: number, targetState?: boolean) => {
    update((p) => {
      const current = p.drums.grid[row];
      const rCycle = p.drums.rowCycles?.[row] ?? p.drums.steps;
      const targetStep = step % rCycle;
      const base: boolean[] = Array.isArray(current)
        ? [...current].map(Boolean)
        : Array.from({ length: p.drums.steps }, () => false);
      while (base.length < p.drums.steps) base.push(false);
      const grid = { ...p.drums.grid, [row]: base.slice(0, p.drums.steps) };
      const nextVal = targetState !== undefined ? targetState : !grid[row][targetStep];
      // Skip redundant store clone and mutation if target pad is already in desired state
      if (grid[row][targetStep] === nextVal) return p;
      grid[row][targetStep] = nextVal;
      return {
        ...p,
        drums: { ...p.drums, patternId: `custom-${p.drums.steps}`, grid },
        originality: { ...p.originality, presetOnly: false },
      };
    });
  };

  const startPainting = (row: DrumRow, step: number) => {
    const rCycle = drums.rowCycles?.[row] ?? drums.steps;
    const currentState = Boolean(drums.grid[row]?.[step % rCycle]);
    const newState = !currentState;
    isPaintingRef.current = newState;
    paintRowRef.current = row;
    lastPaintedStepRef.current = { row, step };
    setIsPainting(newState);
    setCellState(row, step, newState);
  };

  const onPadPointerDown = (row: DrumRow, step: number, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Release implicit touch pointer capture so swipe gestures can reach adjacent DOM elements
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore if pointer capture is unsupported or not yet assigned by browser
    }
    startPainting(row, step);
  };

  const onPadPointerEnter = (row: DrumRow, step: number, e: React.PointerEvent) => {
    const activePainting = isPaintingRef.current;
    const activeRow = paintRowRef.current;
    if (activePainting !== null && activeRow === row && (e.buttons === 1 || e.pointerType === "touch")) {
      if (lastPaintedStepRef.current?.row !== row || lastPaintedStepRef.current?.step !== step) {
        lastPaintedStepRef.current = { row, step };
        setCellState(row, step, activePainting);
      }
    }
  };

  const onPadsPointerMove = (e: React.PointerEvent) => {
    const activePainting = isPaintingRef.current;
    const activeRow = paintRowRef.current;
    if (activePainting === null || !activeRow) return;

    if (e.pointerType === "mouse" && e.buttons !== 1) {
      onGlobalPointerUp();
      return;
    }

    // Dynamic hit-testing: resolve the element directly under the moving finger/cursor
    const targetEl = document.elementFromPoint(e.clientX, e.clientY);
    if (!targetEl) return;

    const padButton = targetEl.closest<HTMLButtonElement>("button[data-step]");
    if (!padButton) return;

    const targetRow = padButton.getAttribute("data-row") as DrumRow;
    const stepAttr = padButton.getAttribute("data-step");
    if (!targetRow || stepAttr === null) return;

    const targetStep = parseInt(stepAttr, 10);
    if (Number.isNaN(targetStep)) return;

    if (targetRow === activeRow) {
      if (lastPaintedStepRef.current?.row !== targetRow || lastPaintedStepRef.current?.step !== targetStep) {
        lastPaintedStepRef.current = { row: targetRow, step: targetStep };
        setCellState(targetRow, targetStep, activePainting);
      }
    }
  };

  const onGlobalPointerUp = () => {
    isPaintingRef.current = null;
    paintRowRef.current = null;
    lastPaintedStepRef.current = null;
    setIsPainting(null);
  };

  const auditionRow = (rowId: DrumRow) => {
    const eng = getEngine();
    // Audition sound on the audio engine using public previewNote
    try {
      const midi = rowId === "kick" ? 36 : rowId === "snare" ? 38 : rowId === "hihat" ? 42 : 46;
      void eng.previewNote(midi, "drums");
    } catch {
      // ignore
    }
  };

  const setSteps = (steps: number) => {
    setFocusCell({ r: 0, c: 0 });
    update((p) => {
      const mk = (arr: boolean[]) => {
        if (arr.length === steps) return arr;
        if (arr.length > steps) return arr.slice(0, steps);
        return [...arr, ...Array.from({ length: steps - arr.length }, () => false)];
      };
      const grid = Object.fromEntries(
        (Object.keys(p.drums.grid) as DrumRow[]).map((r) => [r, mk(p.drums.grid[r])])
      ) as typeof p.drums.grid;
      const mkAccents = (arr: boolean[] | undefined) => {
        if (!Array.isArray(arr)) return Array.from({ length: steps }, () => false);
        if (arr.length === steps) return arr;
        if (arr.length > steps) return arr.slice(0, steps);
        return [...arr, ...Array.from({ length: steps - arr.length }, () => false)];
      };
      return {
        ...p,
        drums: {
          ...p.drums,
          steps,
          grid,
          accents: mkAccents(p.drums.accents),
          patternId: `custom-${steps}`,
        },
      };
    });
  };

  const presets = DRUM_PRESETS.filter((d) => cat === "all" || d.category === cat);

  return (
    <Card
      id="panel-drums"
      className="scroll-mt-20 p-4 sm:p-5 select-none"
      onPointerUp={onGlobalPointerUp}
      onPointerCancel={onGlobalPointerUp}
    >
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => getEngine().previewDrums(project)}
              aria-label="Hear the drums"
              title="Hear one bar of this drum pattern"
              className="tactile-button h-8"
            >
              <Play className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Hear drums
            </Button>
            <Badge title="How many time slots make up one bar">
              {drums.steps} steps per bar
            </Badge>
          </div>
        }
      >
        Drum Sequencer
      </SectionTitle>
      <p className="mb-3 text-[13px] text-[var(--text-secondary)]">
        Each row is one drum sound, each square is a moment in time. Lit squares play, dark squares stay silent.
        Brighter columns mark the main beats. Drag across squares to paint beats smoothly.
      </p>

      {/* Preset and Detail controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Label htmlFor="drumcat">Style</Label>
        <select
          id="drumcat"
          className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] px-2 text-[var(--text-primary)]"
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          title="Show drum patterns for one style, or all of them"
        >
          <option value="all">All styles ({DRUM_PRESETS.length})</option>
          {DRUM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Label title="Fewer steps = simpler feel; more steps = finer detail">Detail</Label>
          <Button
            size="sm"
            variant="outline"
            aria-label="Fewer steps per bar"
            title="Simpler timing grid"
            onClick={() => setSteps(drums.steps === 16 ? 12 : drums.steps === 12 ? 8 : 8)}
            className="h-8 w-8 p-0"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <span className="w-8 text-center font-mono font-bold" title="Time slots per bar">
            {drums.steps}
          </span>
          <Button
            size="sm"
            variant="outline"
            aria-label="More steps per bar"
            title="Finer timing grid"
            onClick={() => setSteps(drums.steps === 8 ? 12 : drums.steps === 12 ? 16 : 16)}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Presets carousel */}
      <div className="mb-4 flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Drum pattern presets">
        {presets.slice(0, 12).map((d) => {
          const isSelected = project.drums.patternId === d.id;
          return (
            <button
              key={d.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => {
                update((p) => ({ ...p, drums: d.build() }));
                announcePreset(d.name);
              }}
              title={`${d.description} (comfortable around ${d.bpmSuggestion[0]}–${d.bpmSuggestion[1]} BPM)`}
              aria-label={`Load ${d.name} drum pattern`}
              className={cn(
                "tactile-button shrink-0 rounded-lg border px-3 py-2 text-left text-[12px] transition-all",
                isSelected
                  ? "border-[var(--border-focus)] bg-[var(--accent-primary)]/15 text-[var(--text-primary)] shadow-[var(--accent-glow)] ring-1 ring-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-input)]/70 text-[var(--text-secondary)] hover:border-[var(--border-interactive)] hover:text-[var(--text-primary)]"
              )}
            >
              <span className="block font-bold">{d.name}</span>
              <span className="block text-[11px] text-[var(--text-muted)]">
                {d.category} • tap to load
              </span>
            </button>
          );
        })}
      </div>

      {/* Sequencer Grid Scroll Container with Sticky Track Labels */}
      <div
        className="overflow-x-auto touch-pan-x rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)] p-2 shadow-inner"
        role="group"
        aria-label="Drum step sequencer"
        aria-describedby="drum-grid-help"
      >
        <div ref={gridRef} className="relative min-w-[580px]">
          {/* Beat Accents row */}
          <div
            role="group"
            aria-label="Step accents"
            className="mb-2.5 flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2"
          >
            {/* Sticky Header Label */}
            <div className="sticky left-0 z-20 flex w-28 shrink-0 items-center justify-between gap-1 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2 py-1 backdrop-blur-md shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
              <span
                aria-hidden="true"
                className="font-mono text-[10px] font-black tracking-wider text-amber-400"
                title="Click to accent specific steps (+25% hit velocity)"
              >
                ACCENT
              </span>
            </div>

            {/* Accents row */}
            <div
              className="grid flex-1 gap-1"
              style={{ gridTemplateColumns: `repeat(${drums.steps}, minmax(36px, 1fr))` }}
            >
              {Array.from({ length: drums.steps }, (_, s) => {
                const accented = Array.isArray(drums.accents) && Boolean(drums.accents[s]);
                return (
                  <button
                    key={`acc-${s}`}
                    type="button"
                    aria-label={`Step ${s + 1} accent ${accented ? "on" : "off"}`}
                    aria-pressed={accented}
                    onClick={() => {
                      update((p) => {
                        const current = Array.isArray(p.drums.accents)
                          ? [...p.drums.accents]
                          : Array.from({ length: p.drums.steps }, () => false);
                        while (current.length < p.drums.steps) current.push(false);
                        current[s] = !current[s];
                        return {
                          ...p,
                          drums: { ...p.drums, accents: current },
                        };
                      });
                    }}
                    className={cn(
                      "tactile-button relative min-h-[36px] sm:min-h-[28px] rounded text-[10px] font-mono font-bold transition-all after:absolute after:-inset-2 after:content-['']",
                      accented
                        ? "bg-amber-400/90 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                        : "bg-white/[0.04] text-[var(--text-muted)] hover:bg-white/[0.1] hover:text-[var(--text-primary)]"
                    )}
                  >
                    {accented ? "▲" : "•"}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pads Rows Container */}
          <div
            ref={padsContainerRef}
            className="relative"
            onPointerMove={onPadsPointerMove}
            onPointerUp={onGlobalPointerUp}
            onPointerCancel={onGlobalPointerUp}
          >
            {/* GPU Zero-Reflow Playhead Cursor */}
            {playing && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-0 bottom-0 z-30 flex w-0 flex-col items-center overflow-visible will-change-transform"
                style={{
                  left: `${gridLeftPx}px`,
                  transform: playheadKinematics.transform,
                }}
              >
                {/* Triangular playhead needle */}
                <div className="h-0 w-0 border-x-4 border-x-transparent border-t-[6px] border-t-[var(--accent-primary)] drop-shadow-[0_0_6px_var(--accent-primary)]" />
                {/* Vertical glowing beam line */}
                <div className="h-full w-[2px] bg-[var(--accent-primary)] shadow-[var(--accent-glow)] opacity-80" />
              </div>
            )}

            {ROWS.map((r, ri) => {
              const rCycle = drums.rowCycles?.[r.id] ?? drums.steps;
              return (
                <div
                  key={r.id}
                  role="group"
                  aria-label={`${r.label} sounds`}
                  className="mb-1.5 flex items-center gap-2"
                >
                  {/* Sticky track header column */}
                  <div className="sticky left-0 z-20 flex w-28 shrink-0 items-center justify-between gap-1 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2 py-1.5 backdrop-blur-md shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                    <button
                      type="button"
                      onClick={() => auditionRow(r.id)}
                      className="tactile-button flex items-center gap-1 font-mono text-[10px] font-bold tracking-wider text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                      title={`Audition ${r.label}`}
                    >
                      <Volume2 className="h-2.5 w-2.5 opacity-60" />
                      {r.label}
                    </button>
                    <select
                      aria-label={`${r.label} cycle length`}
                      title={`Cycle length for ${r.label}`}
                      value={rCycle}
                      onChange={(e) => setRowCycle(r.id, Number(e.target.value))}
                      className="h-6 cursor-pointer rounded border border-[var(--border-subtle)] bg-[var(--bg-input)] px-1 font-mono text-[9px] text-[var(--accent-primary)]"
                    >
                      <option value={drums.steps}>{drums.steps}</option>
                      {[12, 8, 7, 6, 5, 4, 3, 2]
                        .filter((c) => c !== drums.steps)
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Step Pads with 48px touch targets, luminescent flash, and swipe painting */}
                  <div
                    ref={ri === 0 ? padsGridRef : undefined}
                    className="grid flex-1 gap-1"
                    style={{ gridTemplateColumns: `repeat(${drums.steps}, minmax(36px, 1fr))` }}
                  >
                    {Array.from({ length: drums.steps }, (_, s) => {
                      const col = drums.grid[r.id];
                      const cycleStep = s % rCycle;
                      const on = Array.isArray(col) && Boolean(col[cycleStep]);
                      const isRepeatedPhase = s >= rCycle;
                      const isCycleStart = s > 0 && s % rCycle === 0;
                      const beat = drums.steps === 16 ? s % 4 === 0 : s % 3 === 0;
                      const isFlash = isPadTriggered(s, timing.currentStep, rCycle, playing, on);
                      const isPlayheadHere = playing && s === timing.currentStep;

                      return (
                        <button
                          key={s}
                          data-cell={`${ri}-${s}`}
                          data-row={r.id}
                          data-step={s}
                          tabIndex={focusR === ri && focusC === s ? 0 : -1}
                          onKeyDown={(e) => onCellKeyDown(e, ri, s)}
                          onFocus={() => {
                            if (focusCell.r !== ri || focusCell.c !== s) setFocusCell({ r: ri, c: s });
                          }}
                          onPointerDown={(e) => onPadPointerDown(r.id, s, e)}
                          onPointerEnter={(e) => onPadPointerEnter(r.id, s, e)}
                          onClick={() => {
                            setCellState(r.id, s);
                            announceSequencer(r.label, s, !on);
                          }}
                          aria-label={`${r.label} step ${s + 1}${isRepeatedPhase ? ` (cycle step ${cycleStep + 1})` : ""} ${on ? "on" : "off"}`}
                          aria-pressed={on}
                          className={cn(
                            "tactile-pad relative min-h-[48px] sm:min-h-[38px] rounded-md border transition-all touch-none",
                            isCycleStart && "border-l-2 border-l-[var(--accent-primary)]",
                            isFlash && "step-active scale-105 z-10",
                            on
                              ? r.id === "kick"
                                ? isRepeatedPhase
                                  ? "border-[var(--step-kick)]/70 bg-[var(--step-kick)]/70 text-black font-black"
                                  : isFlash
                                  ? "border-white bg-[var(--step-kick)] shadow-[0_0_22px_var(--step-kick)]"
                                  : "border-[var(--step-kick)] bg-[var(--step-kick)] shadow-[var(--accent-glow)]"
                                : r.id === "snare"
                                ? isRepeatedPhase
                                  ? "border-[var(--step-snare)]/70 bg-[var(--step-snare)]/70 text-white font-black"
                                  : isFlash
                                  ? "border-white bg-[var(--step-snare)] shadow-[0_0_22px_var(--step-snare)]"
                                  : "border-[var(--step-snare)] bg-[var(--step-snare)] shadow-[0_0_12px_rgba(188,19,254,0.4)]"
                                : isRepeatedPhase
                                ? "border-[var(--step-hat)]/60 bg-[var(--step-hat)]/60 text-black font-black"
                                : isFlash
                                ? "border-white bg-[var(--step-hat)] shadow-[0_0_20px_var(--step-hat)]"
                                : "border-[var(--step-hat)] bg-[var(--step-hat)] shadow-[0_0_12px_rgba(255,183,3,0.35)]"
                              : isPlayheadHere
                              ? "border-[var(--border-interactive)] bg-white/[0.12]"
                              : beat
                              ? "border-[var(--border-interactive)] bg-white/[0.05] hover:bg-white/[0.12]"
                              : "border-[var(--border-subtle)] bg-white/[0.02] hover:bg-white/[0.08]",
                            isRepeatedPhase && !on && "opacity-50"
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p id="drum-grid-help" className="mt-2 text-[12px] text-[var(--text-secondary)]">
        Touch & drag across pads to paint steps smoothly. Click drum names on the left to audition sounds. Tab enters grid; arrow keys navigate.
      </p>

      {/* Swing and Velocity Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="swing">Swing — {Math.round(drums.swing * 100)}%</Label>
          <Slider
            id="swing"
            min={0}
            max={0.5}
            step={0.01}
            value={drums.swing}
            title="Delays every other step for a looser, groovier feel"
            onChange={(e) => update((p) => ({ ...p, drums: { ...p.drums, swing: Number(e.target.value) } }))}
          />
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            Looseness. 0% marches straight; higher values shuffle and sway.
          </p>
        </div>
        <div>
          <Label htmlFor="dvel">How hard drums hit — {Math.round(drums.velocity * 100)}%</Label>
          <Slider
            id="dvel"
            min={0.3}
            max={1}
            step={0.01}
            value={drums.velocity}
            title="Overall punch of the kit"
            onChange={(e) => update((p) => ({ ...p, drums: { ...p.drums, velocity: Number(e.target.value) } }))}
          />
          <p className="mt-1 text-[12px] text-[var(--text-muted)]">
            Punch. Lower it for gentle verses, raise it for big choruses.
          </p>
        </div>
      </div>
    </Card>
  );
}
