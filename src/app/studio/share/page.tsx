// Share preview & hydration route.
// Displays a song preview before importing it into local storage.
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Music2, ArrowRight, ChevronLeft, Sliders, AlertCircle, CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, Badge } from "@/components/ui";
import { decompressProject, extractPayloadFromUrl } from "@/lib/share-url";
import { saveProject } from "@/lib/storage";
import { useProjectStore } from "@/store/project-store";
import type { SonicProject } from "@/lib/project-schema";

function ShareHydrationContent() {
  const router = useRouter();
  const [project, setProject] = useState<SonicProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const payload = extractPayloadFromUrl(window.location.href);
        if (!payload) {
          setError("No share data found in link. The URL may be truncated.");
          setLoading(false);
          return;
        }
        const decoded = await decompressProject(payload);
        setProject(decoded);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to decode song blueprint");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleOpenInStudio = async () => {
    if (!project) return;
    setImporting(true);
    try {
      await saveProject(project);
      useProjectStore.getState().load(project);
      router.push(`/studio/${project.meta.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save song to local workspace");
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6e8bff]/20 text-[#6e8bff] animate-pulse">
          <Music2 className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Opening Shared Blueprint</h2>
        <p className="mt-2 text-sm text-slate-400">Decompressing and validating song blueprint…</p>
      </Card>
    );
  }

  if (error || !project) {
    return (
      <Card className="mx-auto max-w-lg border-red-500/30 p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-white">Unable to Open Link</h2>
        <p className="mt-2 text-sm text-slate-400">{error ?? "Invalid link"}</p>
        <p className="mt-4 text-xs text-slate-500">
          Your existing projects are completely safe. Please request a new link from the creator.
        </p>
        <div className="mt-6 flex justify-center">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const totalBars = project.arrangement.reduce((acc, s) => acc + s.bars, 0);

  return (
    <Card className="mx-auto max-w-xl p-6 md:p-8">
      <div className="flex items-start justify-between border-b border-[#1e2a4a] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Badge>Shared Song Blueprint</Badge>
            <span className="text-xs text-slate-500">Zero-backend portable</span>
          </div>
          <h1 className="mt-2 text-2xl font-black text-white">{project.meta.name}</h1>
          <p className="mt-1 text-sm text-slate-400">
            Created with SonicBlueprint • Ready to play and customize
          </p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#6e8bff]/15 text-[#6e8bff]">
          <Music2 className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[#1e2a4a] bg-white/[0.02] p-3 text-center">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Tempo</span>
          <p className="mt-1 font-mono text-lg font-bold text-white">{project.config.bpm} BPM</p>
        </div>
        <div className="rounded-xl border border-[#1e2a4a] bg-white/[0.02] p-3 text-center">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Key & Scale</span>
          <p className="mt-1 text-sm font-bold text-white">
            {project.config.keyTonic} {project.config.scale}
          </p>
        </div>
        <div className="rounded-xl border border-[#1e2a4a] bg-white/[0.02] p-3 text-center">
          <span className="text-[11px] font-semibold uppercase text-slate-400">Length</span>
          <p className="mt-1 font-mono text-lg font-bold text-white">{totalBars} bars</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <div className="rounded-xl border border-[#1e2a4a] bg-[#070b16] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Chords Loop</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.chords.chords.map((chord: string, i: number) => (
              <span
                key={i}
                className="rounded-lg border border-[#2a3862] bg-[#12192e] px-2.5 py-1 font-mono text-xs font-bold text-[#aebfff]"
              >
                {chord}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#1e2a4a] bg-[#070b16] p-4">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Arrangement Flow</span>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {project.arrangement.map((sec, i) => (
              <span
                key={sec.id || i}
                className="rounded-lg border border-[#22305c] bg-white/[0.03] px-2 py-0.5 text-xs text-slate-300"
              >
                {sec.name} ({sec.bars}b)
              </span>
            ))}
          </div>
        </div>

        {project.effects && (
          <div className="flex items-center gap-2 text-xs text-slate-400 px-1">
            <Sliders className="h-3.5 w-3.5 text-[#6e8bff]" />
            <span>Master FX: Reverb ({project.effects.reverb.enabled ? "On" : "Bypassed"}), Delay ({project.effects.delay.enabled ? "On" : "Bypassed"}), EQ ({project.effects.eq.enabled ? "On" : "Bypassed"})</span>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-[#26325a] bg-[#6e8bff]/10 p-3.5 flex items-start gap-3">
        <CheckCircle2 className="h-4 w-4 text-[#6e8bff] shrink-0 mt-0.5" />
        <p className="text-xs text-slate-300 leading-relaxed">
          Opening this song will create an independent local copy in your browser. Your existing projects will not be overwritten.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm">
            Cancel
          </Button>
        </Link>
        <Button onClick={handleOpenInStudio} disabled={importing}>
          {importing ? "Saving & Opening…" : "Open in Studio"} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export default function SharePage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-4xl p-4 md:p-8">
        <Suspense fallback={<div className="p-8 text-center text-slate-400">Opening Shared Blueprint…</div>}>
          <ShareHydrationContent />
        </Suspense>
      </div>
    </AppShell>
  );
}
