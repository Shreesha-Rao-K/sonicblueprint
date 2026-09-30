// Arrangement timeline: add/delete/reorder/duplicate/length/energy/instruments.
"use client";

import { ArrowUp, ArrowDown, Copy, Trash2, Plus } from "lucide-react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { uid } from "@/lib/project-schema";
import { Card, SectionTitle, Badge, Label, Slider, Button } from "./ui";
import { cn } from "@/lib/cn";

const SECTION_NAMES = ["INTRO", "VERSE", "PRE-CHORUS", "CHORUS", "BRIDGE", "FINAL CHORUS", "OUTRO", "INTERLUDE", "SOLO", "HOOK"];

export function ArrangementTimeline({ onSelectSection, selectedId }: { onSelectSection?: (id: string | null) => void; selectedId?: string | null }) {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const sectionIndex = useTransportStore((s) => s.sectionIndex);
  if (!project) return null;

  const totalBars = project.arrangement.reduce((a, s) => a + s.bars, 0);

  const move = (idx: number, dir: -1 | 1) => {
    update((p) => {
      const arr = [...p.arrangement];
      const j = idx + dir;
      if (j < 0 || j >= arr.length) return p;
      [arr[idx], arr[j]] = [arr[j], arr[idx]];
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
        Click any block to hear the song from there. Bigger blocks last longer; brighter blocks hit harder.
      </p>

      {/* visual bar — scrolls instead of squeezing so parts stay tappable */}
      <div className="mb-1 flex gap-1 overflow-x-auto rounded-lg pb-1" role="group" aria-label="Song structure — click a part to play from there">
        {project.arrangement.map((s, i) => {
          const isPlaying = i === sectionIndex;
          const isSelected = selectedId ? s.id === selectedId : false;
          return (
          <button
            key={s.id}
            title={`${s.name} — lasts ${s.bars} bars, intensity ${s.energy} of 10. Click to play from here.`}
            aria-label={`${s.name}, ${s.bars} bars, intensity ${s.energy} of 10. Play from here.`}
            aria-pressed={isSelected}
            onClick={() => onSelectSection?.(s.id)}
            className={cn(
              "relative h-16 w-20 min-w-16 shrink-0 rounded-lg border transition-all",
              isPlaying
                ? "border-[#6e8bff] shadow-[0_0_14px_rgba(110,139,255,0.35)]"
                : isSelected
                  ? "border-[#a78bfa] shadow-[0_0_10px_rgba(167,139,250,0.3)]"
                  : "border-[#22305c] hover:-translate-y-0.5 hover:border-[#6e8bff]/60"
            )}
            style={{
              flexGrow: s.bars,
              flexBasis: 0,
              background: `linear-gradient(180deg, rgba(110,139,255,${0.08 + (s.energy / 10) * 0.3}), rgba(167,139,250,${0.05 + (s.energy / 10) * 0.22}))`,
            }}
          >
            <span className="absolute inset-x-1 top-1.5 truncate text-left text-[10px] font-bold uppercase tracking-wider text-slate-200">
              {s.name}
            </span>
            <span className="absolute bottom-1.5 left-1.5 font-mono text-[10px] text-slate-400">{s.bars} bars</span>
            {isSelected && (
              <span className="absolute bottom-1.5 right-1.5 rounded-full bg-[#a78bfa]/25 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[#d6c9ff]">
                start
              </span>
            )}
          </button>
          );
        })}
      </div>
      <p className="mb-3 text-[12px] text-slate-400">
        {selectedId
          ? "The purple “start” tag shows where playback will begin. Press play to hear it."
          : "Tip: click any part to choose where playback begins."}
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
                className="h-9 rounded-lg border border-[#26325a] bg-[#0a0e1a] px-2 text-[13px] font-bold"
              >
                {Array.from(new Set([...SECTION_NAMES, s.name])).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
              <div className="flex items-center gap-1 text-[12px] text-slate-400">
                <button className="rounded px-1.5 py-1 hover:bg-white/10" aria-label="Make this part shorter" title="One bar shorter"
                  onClick={() => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, bars: Math.max(1, x.bars - 1) } : x)) }))}>−</button>
                <span className="w-16 text-center font-mono" title="A bar is one building block of music — this part lasts this many">{s.bars} bars</span>
                <button className="rounded px-1.5 py-1 hover:bg-white/10" aria-label="Make this part longer" title="One bar longer"
                  onClick={() => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, bars: Math.min(32, x.bars + 1) } : x)) }))}>+</button>
              </div>
              <div className="flex min-w-[160px] flex-1 items-center gap-2">
                <Label htmlFor={`en-${s.id}`} title="How intense this part sounds — low for calm verses, high for huge choruses">Intensity {s.energy}</Label>
                <Slider id={`en-${s.id}`} min={1} max={10} step={1} value={s.energy}
                  onChange={(e) => update((p) => ({ ...p, arrangement: p.arrangement.map((x) => (x.id === s.id ? { ...x, energy: Number((e.target as HTMLInputElement).value) } : x)) }))} />
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Move part earlier" title="Move this part earlier in the song" onClick={() => move(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Move part later" title="Move this part later in the song" onClick={() => move(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Duplicate part"
                  title="Make a copy of this part right after it"
                  onClick={() => update((p) => {
                    const arr = [...p.arrangement];
                    arr.splice(i + 1, 0, { ...s, id: uid("sec") });
                    return { ...p, arrangement: arr };
                  })}><Copy className="h-3.5 w-3.5" /></button>
                <button className="rounded p-1.5 text-red-300/70 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent" aria-label="Delete part"
                  title={project.arrangement.length <= 1 ? "A song needs at least one part" : "Remove this part from the song"}
                  disabled={project.arrangement.length <= 1}
                  onClick={() => update((p) => ({ ...p, arrangement: p.arrangement.filter((x) => x.id !== s.id) }))}><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
