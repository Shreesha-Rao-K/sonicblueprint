// Visual step sequencer: interactive grid, presets, subdivisions, preview.
"use client";

import { useRef, useState } from "react";
import { Play, Plus, Minus } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { DRUM_PRESETS, DRUM_CATEGORIES } from "@/data/drums";
import type { DrumRow } from "@/lib/project-schema";
import { getEngine } from "@/lib/audio-engine";
import { Button, Card, Label, SectionTitle, Badge, Slider } from "./ui";
import { cn } from "@/lib/cn";

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
  const [cat, setCat] = useState<string>("all");
  // Roving tabindex: one Tab stop for the whole grid; arrows move within it.
  const [focusCell, setFocusCell] = useState({ r: 0, c: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  if (!project) return null;
  const drums = project.drums;
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
    // Space/Enter toggle natively via the button.
  };

  const toggle = (row: DrumRow, step: number) => {
    update((p) => {
      const current = p.drums.grid[row];
      // A row missing from an imported file behaves as an empty row.
      const base: boolean[] = Array.isArray(current)
        ? [...current].map(Boolean)
        : Array.from({ length: p.drums.steps }, () => false);
      while (base.length < p.drums.steps) base.push(false);
      const grid = { ...p.drums.grid, [row]: base.slice(0, p.drums.steps) };
      grid[row][step] = !grid[row][step];
      return {
        ...p,
        drums: { ...p.drums, patternId: `custom-${p.drums.steps}`, grid },
        originality: { ...p.originality, presetOnly: false },
      };
    });
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
      return { ...p, drums: { ...p.drums, steps, grid, patternId: `custom-${steps}` } };
    });
  };

  const presets = DRUM_PRESETS.filter((d) => cat === "all" || d.category === cat);

  return (
    <Card id="panel-drums" className="scroll-mt-20 p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => getEngine().previewDrums(project)} aria-label="Hear the drums" title="Hear one bar of this drum pattern">
              <Play className="h-3.5 w-3.5" /> Hear drums
            </Button>
            <Badge title="How many time slots make up one bar">{drums.steps} steps per bar</Badge>
          </div>
        }
      >
        Drum Sequencer
      </SectionTitle>
      <p className="mb-3 text-[13px] text-slate-400">
        Each row is one drum sound, each square is a moment in time. Lit squares play, dark squares stay silent.
        Brighter columns mark the main beats. Start from a preset, then tap squares to make it yours.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <Label htmlFor="drumcat">Style</Label>
        <select id="drumcat" className="h-8 rounded-lg border border-[#26325a] bg-[#0a0e1a] px-2" value={cat} onChange={(e) => setCat(e.target.value)} title="Show drum patterns for one style, or all of them">
          <option value="all">All styles ({DRUM_PRESETS.length})</option>
          {DRUM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <Label title="Fewer steps = simpler feel; more steps = finer detail">Detail</Label>
          <Button size="sm" variant="outline" aria-label="Fewer steps per bar" title="Simpler timing grid" onClick={() => setSteps(drums.steps === 16 ? 12 : drums.steps === 12 ? 8 : 8)}><Minus className="h-3 w-3" /></Button>
          <span className="w-8 text-center font-mono" title="Time slots per bar">{drums.steps}</span>
          <Button size="sm" variant="outline" aria-label="More steps per bar" title="Finer timing grid" onClick={() => setSteps(drums.steps === 8 ? 12 : drums.steps === 12 ? 16 : 16)}><Plus className="h-3 w-3" /></Button>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {presets.slice(0, 12).map((d) => (
          <button
            key={d.id}
            onClick={() => update((p) => ({ ...p, drums: d.build() }))}
            title={`${d.description} (comfortable around ${d.bpmSuggestion[0]}–${d.bpmSuggestion[1]} BPM)`}
            aria-label={`Load ${d.name} drum pattern`}
            aria-pressed={project.drums.patternId === d.id}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-2 text-left text-[12px] transition-all active:translate-y-px",
              project.drums.patternId === d.id
                ? "border-[#6e8bff] bg-[#6e8bff]/15 text-white shadow-[0_0_14px_rgba(110,139,255,0.3)]"
                : "border-[#22305c] text-slate-300 hover:-translate-y-0.5 hover:border-[#6e8bff]/60 hover:shadow-[0_4px_14px_rgba(110,139,255,0.15)]"
            )}
          >
            <span className="block font-bold">{d.name}</span>
            <span className="block text-slate-400">{d.category} • tap to load</span>
          </button>
        ))}
      </div>

      <div className="overflow-x-auto" role="group" aria-label="Drum step sequencer" aria-describedby="drum-grid-help">
        <div ref={gridRef} className="min-w-[560px]">
          {ROWS.map((r, ri) => (
            <div key={r.id} role="group" aria-label={`${r.label} sounds`} className="mb-1.5 flex items-center gap-2">
              <span aria-hidden="true" className="w-20 shrink-0 font-mono text-[10px] tracking-wider text-slate-400" title={r.hint}>{r.label}</span>
              <div className="grid flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${drums.steps}, minmax(0,1fr))` }}>
                {Array.from({ length: drums.steps }, (_, s) => {
                  const col = (drums.grid as Record<string, unknown>)[r.id];
                  const on = Array.isArray(col) && Boolean(col[s]);
                  const beat = drums.steps === 16 ? s % 4 === 0 : s % 3 === 0;
                  return (
                    <button
                      key={s}
                      data-cell={`${ri}-${s}`}
                      tabIndex={focusR === ri && focusC === s ? 0 : -1}
                      onKeyDown={(e) => onCellKeyDown(e, ri, s)}
                      onFocus={() => {
                        if (focusCell.r !== ri || focusCell.c !== s) setFocusCell({ r: ri, c: s });
                      }}
                      aria-label={`${r.label} step ${s + 1} ${on ? "on" : "off"}`}
                      aria-pressed={on}
                      onClick={() => toggle(r.id, s)}
                      className={cn(
                        "h-8 rounded-md border transition-all active:scale-95",
                        on
                          ? r.id === "kick" ? "border-[#6e8bff] bg-[#6e8bff] glow-dot"
                            : r.id === "snare" ? "border-[#a78bfa] bg-[#a78bfa]"
                            : "border-[#5eead4] bg-[#5eead4]/80"
                          : beat ? "border-[#2a3a6b] bg-white/[0.06] hover:bg-white/[0.12]"
                            : "border-[#1e2a4a] bg-white/[0.02] hover:bg-white/[0.08]"
                      )}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p id="drum-grid-help" className="mt-2 text-[12px] text-slate-400">
        Keyboard: press Tab once to enter the grid, then use arrow keys to move and Space to switch a sound on or off.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="swing">Swing — {Math.round(drums.swing * 100)}%</Label>
          <Slider id="swing" min={0} max={0.5} step={0.01} value={drums.swing} title="Delays every other step for a looser, groovier feel — 0% is perfectly straight"
            onChange={(e) => update((p) => ({ ...p, drums: { ...p.drums, swing: Number(e.target.value) } }))} />
          <p className="mt-1 text-[12px] text-slate-400">Looseness. 0% marches straight; higher values shuffle and sway.</p>
        </div>
        <div>
          <Label htmlFor="dvel">How hard drums hit — {Math.round(drums.velocity * 100)}%</Label>
          <Slider id="dvel" min={0.3} max={1} step={0.01} value={drums.velocity} title="Overall punch of the kit — lower is softer and gentler"
            onChange={(e) => update((p) => ({ ...p, drums: { ...p.drums, velocity: Number(e.target.value) } }))} />
          <p className="mt-1 text-[12px] text-slate-400">Punch. Lower it for gentle verses, raise it for big choruses.</p>
        </div>
      </div>
    </Card>
  );
}
