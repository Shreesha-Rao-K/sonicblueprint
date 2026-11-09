"use client";

import { Card } from "./ui";

export function PanelSkeleton({
  height = "h-48",
  label = "Loading panel...",
}: {
  height?: string;
  label?: string;
}) {
  return (
    <Card className={`flex flex-col justify-between p-5 ${height} animate-pulse bg-[var(--bg-surface)]`}>
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="h-4 w-12 rounded bg-white/10" />
      </div>
      <div className="space-y-2">
        <div className="h-8 w-full rounded bg-white/5" />
        <div className="h-8 w-3/4 rounded bg-white/5" />
      </div>
      <div className="flex justify-between items-center text-xs text-slate-500">
        <span>{label}</span>
        <div className="h-3 w-16 rounded bg-white/10" />
      </div>
    </Card>
  );
}

export function DrumSequencerSkeleton() {
  return (
    <Card className="p-5 h-[360px] animate-pulse bg-[var(--bg-surface)] flex flex-col justify-between">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
        <div className="h-4 w-40 rounded bg-white/10" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded bg-white/10" />
          <div className="h-7 w-16 rounded bg-white/10" />
        </div>
      </div>
      <div className="grid grid-cols-16 gap-1 my-auto">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="h-6 rounded bg-white/5" />
        ))}
      </div>
      <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-[var(--border-subtle)]">
        <span>Drum Sequencer · 16 steps</span>
        <div className="h-3 w-24 rounded bg-white/10" />
      </div>
    </Card>
  );
}

export function ArrangementTimelineSkeleton() {
  return (
    <Card className="p-5 h-[240px] animate-pulse bg-[var(--bg-surface)] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="h-4 w-48 rounded bg-white/10" />
        <div className="h-6 w-24 rounded bg-white/10" />
      </div>
      <div className="flex gap-2 my-auto overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 flex-1 rounded-lg bg-white/5" />
        ))}
      </div>
      <div className="text-xs text-slate-500">Arrangement Timeline</div>
    </Card>
  );
}

export function MasterEffectsSkeleton() {
  return (
    <Card className="p-5 h-[280px] animate-pulse bg-[var(--bg-surface)] flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="h-6 w-16 rounded bg-white/10" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-white/5" />
        ))}
      </div>
      <div className="text-xs text-slate-500">Master Effects Rack</div>
    </Card>
  );
}

export function FretboardSkeleton() {
  return <PanelSkeleton height="h-[180px]" label="Guitar & Bass Fretboard" />;
}

export function PianoPreviewSkeleton() {
  return <PanelSkeleton height="h-[150px]" label="Piano Harmony Preview" />;
}

export function SidebarPanelSkeleton({ title }: { title: string }) {
  return <PanelSkeleton height="h-[200px]" label={title} />;
}
