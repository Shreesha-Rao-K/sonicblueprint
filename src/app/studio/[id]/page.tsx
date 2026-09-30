// Studio editor — the DAW-inspired workspace.
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ChevronLeft, Undo2, Redo2 } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TransportBar } from "@/components/TransportBar";
import { ChordEditor } from "@/components/ChordEditor";
import { DrumSequencer } from "@/components/DrumSequencer";
import { BassPanel } from "@/components/BassPanel";
import { InstrumentMixer } from "@/components/InstrumentMixer";
import { ArrangementTimeline } from "@/components/ArrangementTimeline";
import { ExportPanel } from "@/components/ExportPanel";
import { OriginalityPanel } from "@/components/OriginalityPanel";
import { PianoPreview } from "@/components/PianoPreview";
import { Button, TextInput } from "@/components/ui";
import { StudioGuide } from "@/components/StudioGuide";
import { LayerToggles } from "@/components/LayerToggles";
import { PanelErrorBoundary } from "@/components/ErrorBoundary";
import { useProjectStore } from "@/store/project-store";
import { loadProject } from "@/lib/storage";

export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const project = useProjectStore((s) => s.project);
  const dirty = useProjectStore((s) => s.dirty);
  const saving = useProjectStore((s) => s.saving);
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const [ready, setReady] = useState(false);
  const [playFrom, setPlayFrom] = useState<string | null>(null);

  // Warn before losing unsaved work on refresh / tab close.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useProjectStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Ctrl/Cmd+Z = undo, Ctrl/Cmd+Shift+Z or Ctrl+Y = redo (never inside text fields).
  useEffect(() => {
    const inField = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("input, textarea, select, [contenteditable]");
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "z") {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
          if (inField(e.target)) return;
          e.preventDefault();
          useProjectStore.getState().redo();
        }
        return;
      }
      if (inField(e.target)) return;
      e.preventDefault();
      const store = useProjectStore.getState();
      if (e.shiftKey) store.redo();
      else store.undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let live = true;
    (async () => {
      const current = useProjectStore.getState().project;
      if (current && current.meta.id === id) {
        setReady(true);
        return;
      }
      const stored = await loadProject(id);
      if (!live) return;
      if (stored) {
        useProjectStore.getState().load(stored);
        setReady(true);
      } else {
        router.replace("/dashboard");
      }
    })();
    return () => {
      live = false;
    };
  }, [id, router]);

  if (!ready || !project) {
    return (
      <AppShell>
        <div className="grid gap-3 p-8" role="status" aria-label="Opening project">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-white/5" />)}
          <p className="text-sm text-slate-400">Opening your project…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TransportBar fromSectionId={playFrom} />
      <div className="mx-auto max-w-[1400px] space-y-4 p-4 md:p-6">
        <h1 className="sr-only">Studio — {project.meta.name}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-[13px] text-slate-400 hover:text-white">
            <ChevronLeft aria-hidden="true" className="h-4 w-4" /> Dashboard
          </Link>
          <TextInput
            value={project.meta.name}
            onChange={(e) => useProjectStore.getState().rename(e.target.value)}
            aria-label="Project name"
            className="max-w-xs font-bold"
          />
          <span className="font-mono text-[11px] text-slate-400" title="Musical home note, speed, beat grouping and save state">
            {project.config.keyTonic.replace("b", "♭")} {project.config.scale} • {project.config.bpm} BPM • {project.config.timeSignature}
            {dirty ? " • unsaved changes" : " • saved"}
          </span>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPlayFrom(null)} title="Start playback from the very beginning">
              Whole song
            </Button>
            <div className="flex gap-1" role="group" aria-label="Undo and redo">
              <Button
                variant="outline"
                size="sm"
                onClick={() => useProjectStore.getState().undo()}
                disabled={!canUndo}
                aria-label="Undo last change"
                title="Undo last change (Ctrl+Z)"
                className="px-2.5"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => useProjectStore.getState().redo()}
                disabled={!canRedo}
                aria-label="Redo change"
                title="Redo change (Ctrl+Shift+Z)"
                className="px-2.5"
              >
                <Redo2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <Button
              onClick={() => useProjectStore.getState().save()}
              disabled={saving}
              size="sm"
              title={dirty ? "Store this project in this browser" : "All changes are stored"}
            >
              <Save aria-hidden="true" className="h-3.5 w-3.5" /> {saving ? "Saving…" : dirty ? "Save" : "Saved ✓"}
            </Button>
          </div>
        </div>

        <StudioGuide />

        {playFrom && (
          <p className="rounded-lg border border-[#6e8bff]/40 bg-[#6e8bff]/10 px-3 py-2 text-[13px] text-slate-200">
            Starting playback from the part you picked. <button className="underline" onClick={() => setPlayFrom(null)}>Play the whole song instead</button>
          </p>
        )}

        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-4">
            <PanelErrorBoundary label="Mix layers"><LayerToggles /></PanelErrorBoundary>
            <PanelErrorBoundary label="Chord editor"><ChordEditor /></PanelErrorBoundary>
            <PanelErrorBoundary label="Harmony preview"><PianoPreview /></PanelErrorBoundary>
            <PanelErrorBoundary label="Drum sequencer"><DrumSequencer /></PanelErrorBoundary>
            <PanelErrorBoundary label="Bass and melody"><BassPanel /></PanelErrorBoundary>
            <PanelErrorBoundary label="Instruments"><InstrumentMixer /></PanelErrorBoundary>
            <PanelErrorBoundary label="Arrangement"><ArrangementTimeline onSelectSection={(sid) => setPlayFrom(sid)} selectedId={playFrom} /></PanelErrorBoundary>
          </div>
          <div className="space-y-4">
            <PanelErrorBoundary label="Export"><ExportPanel /></PanelErrorBoundary>
            <PanelErrorBoundary label="Originality"><OriginalityPanel /></PanelErrorBoundary>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
