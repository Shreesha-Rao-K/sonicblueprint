// Studio editor — the DAW-inspired workspace.
"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Save, ChevronLeft, Undo2, Redo2, Keyboard, Sliders } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { TransportBar } from "@/components/TransportBar";
import { ChordEditor } from "@/components/ChordEditor";
import { Button, TextInput } from "@/components/ui";
import { StudioGuide } from "@/components/StudioGuide";
import { LayerToggles } from "@/components/LayerToggles";
import { PanelErrorBoundary } from "@/components/ErrorBoundary";
import {
  DrumSequencerSkeleton,
  ArrangementTimelineSkeleton,
  MasterEffectsSkeleton,
  FretboardSkeleton,
  PianoPreviewSkeleton,
  SidebarPanelSkeleton,
} from "@/components/PanelSkeletons";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { getEngine } from "@/lib/audio-engine";
import { loadProject } from "@/lib/storage";

// Below-the-fold & heavy panels dynamically code-split with zero-CLS skeletons
const DrumSequencer = dynamic(
  () => import("@/components/DrumSequencer").then((m) => m.DrumSequencer),
  { ssr: false, loading: () => <DrumSequencerSkeleton /> }
);
const ArrangementTimeline = dynamic(
  () => import("@/components/ArrangementTimeline").then((m) => m.ArrangementTimeline),
  { ssr: false, loading: () => <ArrangementTimelineSkeleton /> }
);
const MasterEffectsPanel = dynamic(
  () => import("@/components/MasterEffectsPanel").then((m) => m.MasterEffectsPanel),
  { ssr: false, loading: () => <MasterEffectsSkeleton /> }
);
const InstrumentMixer = dynamic(
  () => import("@/components/InstrumentMixer").then((m) => m.InstrumentMixer),
  { ssr: false, loading: () => <SidebarPanelSkeleton title="Instrument Mixer" /> }
);
const BassPanel = dynamic(
  () => import("@/components/BassPanel").then((m) => m.BassPanel),
  { ssr: false, loading: () => <SidebarPanelSkeleton title="Bass & Melody" /> }
);
const PianoPreview = dynamic(
  () => import("@/components/PianoPreview").then((m) => m.PianoPreview),
  { ssr: false, loading: () => <PianoPreviewSkeleton /> }
);
const FretboardViewer = dynamic(
  () => import("@/components/FretboardViewer").then((m) => m.FretboardViewer),
  { ssr: false, loading: () => <FretboardSkeleton /> }
);
const ExportPanel = dynamic(
  () => import("@/components/ExportPanel").then((m) => m.ExportPanel),
  { ssr: false, loading: () => <SidebarPanelSkeleton title="Export & Share" /> }
);
const VersionPanel = dynamic(
  () => import("@/components/VersionPanel").then((m) => m.VersionPanel),
  { ssr: false, loading: () => <SidebarPanelSkeleton title="Versions" /> }
);
const OriginalityPanel = dynamic(
  () => import("@/components/OriginalityPanel").then((m) => m.OriginalityPanel),
  { ssr: false, loading: () => <SidebarPanelSkeleton title="Originality" /> }
);

// Modals and drawers loaded completely on demand
const KeyboardShortcutsModal = dynamic(
  () => import("@/components/KeyboardShortcutsModal").then((m) => m.KeyboardShortcutsModal),
  { ssr: false }
);
const MobileBottomDrawer = dynamic(
  () => import("@/components/MobileBottomDrawer").then((m) => m.MobileBottomDrawer),
  { ssr: false }
);

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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [mobileDrawerTab, setMobileDrawerTab] = useState<"mixer" | "effects" | null>(null);

  // Warn before losing unsaved work on refresh / tab close.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useProjectStore.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Studio keyboard shortcuts: Space (play/pause), Ctrl+Z/Y (undo/redo), Ctrl+S (save), 1-4 (layers), ? (help).
  useEffect(() => {
    const inField = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest("input, textarea, select, [contenteditable]");
    const isInteractiveTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false;
      if (inField(t)) return true;
      if (t.tagName === "BUTTON" || !!t.closest("button")) return true;
      if (t.hasAttribute("data-cell") || !!t.closest("[data-cell]")) return true;
      if (t.hasAttribute("data-gate") || !!t.closest("[data-gate]")) return true;
      const role = t.getAttribute("role");
      return role === "button" || role === "slider" || role === "switch" || role === "radio" || role === "tab";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      // 1. Play / Pause with Space
      if (e.code === "Space") {
        if (isInteractiveTarget(e.target)) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("sonic:toggle-playback"));
        return;
      }

      // 2. Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (inField(e.target)) return;
        e.preventDefault();
        const store = useProjectStore.getState();
        if (e.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        if (inField(e.target)) return;
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }

      // 3. Save with Ctrl/Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        useProjectStore.getState().save();
        return;
      }

      // 4. Quick layer toggles & shortcuts modal (unmodified keys outside fields)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !inField(e.target)) {
        const store = useProjectStore.getState();
        if (e.key === "1") {
          e.preventDefault();
          store.update((p) => ({ ...p, layers: { ...p.layers, chords: !p.layers.chords } }));
          return;
        }
        if (e.key === "2") {
          e.preventDefault();
          store.update((p) => ({ ...p, layers: { ...p.layers, bass: !p.layers.bass } }));
          return;
        }
        if (e.key === "3") {
          e.preventDefault();
          store.update((p) => ({ ...p, layers: { ...p.layers, drums: !p.layers.drums } }));
          return;
        }
        if (e.key === "4") {
          e.preventDefault();
          store.update((p) => ({ ...p, layers: { ...p.layers, melody: !p.layers.melody } }));
          return;
        }
        if (e.key === "?") {
          e.preventDefault();
          setShowShortcuts((prev) => !prev);
          return;
        }
      }

      // 5. Escape closes shortcuts modal & mobile drawer
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setMobileDrawerTab(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    let live = true;
    // Never let audio from a previous project (or page) keep playing inaudibly.
    getEngine().stop(false);
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
      // Unmounting the studio must silence the scheduler: no ghost audio.
      getEngine().stop(false);
      // Drop stale playback state so a later visit can't resume a dead song.
      useTransportStore.getState().set({
        playing: false,
        positionSec: 0,
        chordIndex: 0,
        sectionIndex: 0,
        audio: "idle",
        audioError: null,
      });
    };
  }, [id, router]);

  // Handle ?focus= search parameter for tutorial deep-linking
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const focus = searchParams.get("focus");
      if (focus) {
        // Find element by selector
        const el = document.querySelector(focus) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-4", "ring-[var(--accent-primary)]/80", "animate-pulse", "rounded-2xl");
          timer = setTimeout(() => {
            el.classList.remove("ring-4", "ring-[var(--accent-primary)]/80", "animate-pulse", "rounded-2xl");
          }, 3500);
        }
      }
    } catch {
      // ignore invalid selector
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [ready]);

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
              title={dirty ? "Store this project in this browser (Ctrl+S)" : "All changes are stored"}
            >
              <Save aria-hidden="true" className="h-3.5 w-3.5" /> {saving ? "Saving…" : dirty ? "Save" : "Saved ✓"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowShortcuts(true)}
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="px-2.5"
            >
              <Keyboard className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileDrawerTab("mixer")}
              aria-label="Mobile quick studio drawer"
              title="Quick Mixer & FX Drawer (Mobile)"
              className="px-2.5 md:hidden"
            >
              <Sliders className="h-4 w-4 text-[var(--accent-primary)]" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <StudioGuide />

        {playFrom && (
          <p className="rounded-lg border border-[#6e8bff]/40 bg-[#6e8bff]/10 px-3 py-2 text-[13px] text-slate-200">
            Starting playback from the part you picked. <button className="underline" onClick={() => setPlayFrom(null)}>Play the whole song instead</button>
          </p>
        )}

        <div id="panel-overview" className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="min-w-0 space-y-4">
            <div id="panel-layers"><PanelErrorBoundary label="Mix layers"><LayerToggles /></PanelErrorBoundary></div>
            <div id="panel-chords"><PanelErrorBoundary label="Chord editor"><ChordEditor /></PanelErrorBoundary></div>
            <div id="panel-harmony"><PanelErrorBoundary label="Harmony preview"><PianoPreview /></PanelErrorBoundary></div>
            <div id="panel-fretboard"><PanelErrorBoundary label="Guitar and bass fretboard"><FretboardViewer /></PanelErrorBoundary></div>
            <div id="panel-drums"><PanelErrorBoundary label="Drum sequencer"><DrumSequencer /></PanelErrorBoundary></div>
            <div id="panel-bass"><PanelErrorBoundary label="Bass and melody"><BassPanel /></PanelErrorBoundary></div>
            <div id="panel-mixer"><PanelErrorBoundary label="Instruments"><InstrumentMixer /></PanelErrorBoundary></div>
            <div id="panel-effects"><PanelErrorBoundary label="Master effects"><MasterEffectsPanel /></PanelErrorBoundary></div>
            <div id="panel-structure"><PanelErrorBoundary label="Arrangement"><ArrangementTimeline onSelectSection={(sid) => setPlayFrom(sid)} selectedId={playFrom} /></PanelErrorBoundary></div>
          </div>
          <div className="space-y-4">
            <div id="panel-export"><PanelErrorBoundary label="Export"><ExportPanel /></PanelErrorBoundary></div>
            <div id="panel-versions"><PanelErrorBoundary label="Versions"><VersionPanel /></PanelErrorBoundary></div>
            <div id="panel-originality"><PanelErrorBoundary label="Originality"><OriginalityPanel /></PanelErrorBoundary></div>
          </div>
        </div>
      </div>
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <MobileBottomDrawer
        isOpen={mobileDrawerTab !== null}
        onClose={() => setMobileDrawerTab(null)}
        title={mobileDrawerTab === "mixer" ? "Quick Mixer" : mobileDrawerTab === "effects" ? "Master Effects" : "Studio Controls"}
      >
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-[var(--border-subtle)] pb-2">
            <button
              onClick={() => setMobileDrawerTab("mixer")}
              className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                mobileDrawerTab === "mixer"
                  ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Mixer
            </button>
            <button
              onClick={() => setMobileDrawerTab("effects")}
              className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${
                mobileDrawerTab === "effects"
                  ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] font-semibold"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Master Effects
            </button>
          </div>
          {mobileDrawerTab === "mixer" && <InstrumentMixer />}
          {mobileDrawerTab === "effects" && <MasterEffectsPanel />}
        </div>
      </MobileBottomDrawer>
    </AppShell>
  );
}
