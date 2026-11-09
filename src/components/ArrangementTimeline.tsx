// Arrangement timeline: add/delete/reorder/duplicate/length/energy/instruments.
"use client";

import { useState } from "react";
import { ArrowUp, ArrowDown, Copy, Trash2, Plus, Scissors, GripVertical } from "lucide-react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { uid } from "@/lib/project-schema";
import { energyJourney, energyLabel } from "@/lib/energy";
import { Card, SectionTitle, Badge, Label, Slider, Button } from "./ui";
import { cn } from "@/lib/cn";

const SECTION_NAMES = ["INTRO", "VERSE", "PRE-CHORUS", "CHORUS", "BRIDGE", "FINAL CHORUS", "OUTRO", "INTERLUDE", "SOLO", "HOOK"];

export function ArrangementTimeline({ onSelectSection, selectedId }: { onSelectSection?: (id: string | null) => void; selectedId?: string | null }) {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const sectionIndex = useTransportStore((s) => s.sectionIndex);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  if (!project) return null;

  const totalBars = project.arrangement.reduce((a, s) => a + s.bars, 0);
  const journey = energyJourney(project.arrangement);

  const move = (idx: number, dir: -1 | 1) => {
    update((p) => {
      const arr = [...p.arrangement];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
      return { ...p, arrangement: arr };
    });
  };

  const reorder = (from: number, to: number) => {
    if (from === to) return;
    update((p) => {
      const arr = [...p.arrangement];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { ...p, arrangement: arr };
    });
  };

  const split = (idx: number) => {
    update((p) => {
      const sec = p.arrangement[idx];
      if (!sec || sec.bars < 2) return p;
      const leftBars = Math.floor(sec.bars / 2);
      const rightBars = sec.bars - leftBars;
      const arr = [...p.arrangement];
      arr.splice(idx, 1,
        { ...sec, id: uid("sec"), bars: leftBars },
        { ...sec, id: uid("sec"), bars: rightBars }
      );
      return { ...p, arrangement: arr };
    });
  };

  return (
    <Card id="panel-structure" className="scroll-mt-20 p-5">
      <SectionTitle
        right={
          <div className="flex items-center gap-2">
            <Badge title="Total length of your song in building blocks">{totalBars} bars total</Badge>
            <Button size="sm" variant="outline" title="Add another part to the end of your song" onClick={() => {
              update((p) => ({
                ...p,
                arrangement: [...p.arrangement, { id: uid("sec"), name: "VERSE", bars: 4, energy: 6, instruments: [] }],
              }));
            }}>
              <Plus className="h-3.5 w-3.5" /> Add part
            </Button>
          </div>
        }
      >
        Song Structure
      </SectionTitle>
      <p className="mb-3 text-[13px] text-slate-400">
        Your song in parts, left to right — quiet intro, verses, big chorus, and so on.
        Drag blocks to reorder, or click any block to play from there.
      </p>

      {/* visual bar — scrolls instead of squeezing so parts stay tappable */}
      <div className="mb-1 flex gap-1.5 overflow-x-auto rounded-lg pb-1.5 pt-0.5" role="group" aria-label="Song structure — drag to reorder or click a part to play">
        {project.arrangement.map((s, i) => {
          const isPlaying = i === sectionIndex;
          const isSelected = selectedId ? s.id === selectedId : false;
          const isDragOver = dragOverIdx === i;
          return (
          <div
            key={s.id}
            draggable
            onDragStart={(e) => {
              setDraggedIdx(i);
              e.dataTransfer.setData("text/plain", String(i));
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragOverIdx !== i) setDragOverIdx(i);
            }}
            onDragLeave={() => {
              if (dragOverIdx === i) setDragOverIdx(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (draggedIdx !== null && draggedIdx !== i) {
                reorder(draggedIdx, i);
              }
              setDraggedIdx(null);
              setDragOverIdx(null);
            }}
            onDragEnd={() => {
              setDraggedIdx(null);
              setDragOverIdx(null);
            }}
            style={{
              flexGrow: s.bars,
              flexBasis: 0,
            }}
            className="min-w-16 shrink-0"
          >
            <button
              type="button"
              title={`${s.name} — ${s.bars} bars, ${energyLabel(s.energy)} (${s.energy}/10). Click to start here, or drag to reorder.`}
              aria-label={`${s.name}, ${s.bars} bars, ${energyLabel(s.energy)}. Click to play from here.`}
              aria-pressed={isSelected}
              onClick={() => onSelectSection?.(s.id)}
              className={cn(
                "relative h-16 w-full rounded-lg border text-left transition-all cursor-grab active:cursor-grabbing",
                isPlaying
                  ? "border-[#6e8bff] shadow-[0_0_14px_rgba(110,139,255,0.35)]"
                  : isSelected
                    ? "border-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                    : isDragOver
                      ? "border-[#38bdf8] scale-[1.02] shadow-[0_0_12px_rgba(56,189,248,0.4)]"
                      : "border-[#22305c] hover:-translate-y-0.5 hover:border-[#6e8bff]/60",
                draggedIdx === i ? "opacity-40" : "opacity-100"
              )}
              style={{
                background: `linear-gradient(180deg, rgba(110,139,255,${0.08 + (s.energy / 10) * 0.3}), rgba(167,139,250,${0.05 + (s.energy / 10) * 0.22}))`,
              }}
            >
              <div className="absolute inset-x-1.5 top-1.5 flex items-center justify-between">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-200">
                  {s.name}
                </span>
                <GripVertical className="h-3 w-3 shrink-0 text-slate-500 opacity-60" aria-hidden="true" />
              </div>
              <span className="absolute bottom-1.5 left-1.5 font-mono text-[10px] text-slate-400">
                {s.bars} bars · {energyLabel(s.energy).toLowerCase()}
              </span>
              {isSelected && (
                <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#a78bfa]/25 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[#d6c9ff]">
                  start
                </span>
              )}
            </button>
          </div>
          );
        })}
      </div>
      <p className="mb-3 text-[12px] text-slate-400">
        {selectedId
          ? "The purple “start” tag shows where playback will begin. Press play to hear it."
          : "Tip: click any part to choose where playback begins, or drag blocks horizontally to reorder."}
        {" "}Energy journey: {journey.join(" → ")}.
      </p>

      <div className="grid gap-2">
        {project.arrangement.map((s, i) => (
          <div key={s.id} className={cn("rounded-lg border p-3", i === sectionIndex ? "border-[#6e8bff]/70 bg-[#6e8bff]/5" : "border-[#1e2a4a] bg-white/[0.015]")}>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={s.name}
                aria-label={`Part ${i + 1} type`}
                title="What kind of part this is — verse, chorus, intro…"
                onChange={(e) => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, name: e.target.value } : x)) }))}
                className="h-10 min-w-[110px] rounded-lg border border-[#26325a] bg-[#0a0e1a] px-2.5 text-[13px] font-bold"
              >
                {Array.from(new Set([...SECTION_NAMES, s.name])).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <div className="flex items-center gap-1 text-[12px] text-slate-400">
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded hover:bg-white/10 text-base font-bold text-slate-300"
                  aria-label={`Make ${s.name} (part ${i + 1}) shorter`}
                  title="One bar shorter"
                  onClick={() => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, bars: Math.max(1, x.bars - 1) } : x)) }))}
                >
                  −
                </button>
                <span className="w-16 text-center font-mono font-medium text-slate-300" title="A bar is one building block of music — this part lasts this many">
                  {s.bars} bars
                </span>
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded hover:bg-white/10 text-base font-bold text-slate-300"
                  aria-label={`Make ${s.name} (part ${i + 1}) longer`}
                  title="One bar longer"
                  onClick={() => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, bars: Math.min(32, x.bars + 1) } : x)) }))}
                >
                  +
                </button>
              </div>
              <div className="flex min-w-[160px] flex-1 items-center gap-2">
                <Label htmlFor={`en-${s.id}`} title="How intense this part sounds — low for calm verses, high for huge choruses">
                  Intensity {s.energy} · {energyLabel(s.energy)}
                </Label>
                <Slider
                  id={`en-${s.id}`}
                  min={1}
                  max={10}
                  step={1}
                  value={s.energy}
                  onChange={(e) => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, energy: Number((e.target as HTMLInputElement).value) } : x)) }))}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label={`Move ${s.name} (part ${i + 1}) earlier`}
                  title="Move this part earlier in the song"
                  onClick={() => move(i, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label={`Move ${s.name} (part ${i + 1}) later`}
                  title="Move this part later in the song"
                  onClick={() => move(i, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white"
                  aria-label={`Duplicate ${s.name} (part ${i + 1})`}
                  title="Make a copy of this part right after it"
                  onClick={() => update((p) => {
                    const arr = [...p.arrangement];
                    arr.splice(i + 1, 0, { ...s, id: uid("sec") });
                    return { ...p, arrangement: arr };
                  })}
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={`Split ${s.name} (part ${i + 1}) into two halves`}
                  title={s.bars < 2 ? "A part must be at least 2 bars to split" : "Split into two equal parts"}
                  disabled={s.bars < 2}
                  onClick={() => split(i)}
                >
                  <Scissors className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded text-red-300/70 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label={`Delete ${s.name} (part ${i + 1})`}
                  title={project.arrangement.length <= 1 ? "A song needs at least one part" : "Remove this part from the song"}
                  disabled={project.arrangement.length <= 1}
                  onClick={() => update((p) => ({ ...p, arrangement: p.arrangement.filter((x) => x.id !== s.id) }))}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
