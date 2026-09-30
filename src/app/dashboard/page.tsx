// Dashboard: branding, create, recent, presets, quick starts, search, last edited.
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search, Clock, FolderOpen, Sparkles, Trash2, Copy } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, TextInput, Badge } from "@/components/ui";
import { QUICK_STARTS } from "@/data/styles";
import { CHORD_PROGRESSIONS, resolvePresetChords } from "@/data/chords";
import { DRUM_PRESETS } from "@/data/drums";
import { createProject, type SonicProject } from "@/lib/project-schema";
import { listProjects, saveProject, deleteProject, getLastEditedId } from "@/lib/storage";
import { useProjectStore } from "@/store/project-store";

function DashboardInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [projects, setProjects] = useState<SonicProject[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    setProjects(await listProjects());
    setLoading(false);
  };

  const openProject = (p: SonicProject) => {
    useProjectStore.getState().load(p);
    router.push(`/studio/${p.meta.id}`);
  };

  const startBlank = async () => {
    const p = createProject(`Track ${String(projects.length + 1).padStart(2, "0")}`);
    await saveProject(p);
    openProject(p);
  };

  useEffect(() => {
    // Initial data load only: fetch saved projects, then honor ?new=1 deep links.
    // Mount-time store hydration; the extra render is intentional and happens once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    if (params.get("new") === "1") {
      void startBlank();
    }
    // Runs once on mount by design; refresh/startBlank intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(
    () => projects.filter((p) => p.meta.name.toLowerCase().includes(q.toLowerCase())),
    [projects, q]
  );
  const lastId = typeof window !== "undefined" ? getLastEditedId() : null;
  const last = projects.find((p) => p.meta.id === lastId) ?? projects[0];

  const startQuick = async (id: string) => {
    const qs = QUICK_STARTS.find((x) => x.id === id);
    if (!qs) return;
    const prog = CHORD_PROGRESSIONS.find((c) => c.id === qs.progressionId) ?? CHORD_PROGRESSIONS[0];
    const chords = resolvePresetChords(prog, qs.tonic);
    const drum = DRUM_PRESETS.find((d) => d.id === qs.drumId)?.build();
    const p = createProject(qs.title, {
      config: {
        bpm: qs.bpm, keyTonic: qs.tonic, scale: qs.scale,
        timeSignature: "4/4", mood: qs.mood, energy: qs.energy, dynamics: 6,
      },
      chords: { progressionId: prog.id, chords, beatsPerChord: 4, octave: 3 },
      drums: drum,
      bass: { styleId: qs.bassStyle as never, octave: 1, volume: 0.85 },
    });
    await saveProject(p);
    openProject(p);
  };

  const duplicate = async (p: SonicProject) => {
    const copy: SonicProject = {
      ...p,
      meta: { ...p.meta, id: `proj_${Math.random().toString(36).slice(2, 9)}`, name: `${p.meta.name} (copy)`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), version: 1 },
    };
    await saveProject(copy);
    refresh();
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete “${name}”? You can keep a copy first with the backup button.`)) return;
    await deleteProject(id);
    refresh();
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px] space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Dashboard</h1>
            <p className="text-sm text-slate-400">Design the music. Build the blueprint. Produce the track.</p>
          </div>
          <div className="ml-auto flex gap-2">
            <Button onClick={startBlank}><Plus aria-hidden="true" className="h-4 w-4" /> Create New Project</Button>
          </div>
        </div>

        {last && (
          <Card className="grid-bg flex flex-wrap items-center gap-4 p-5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                <Clock aria-hidden="true" className="h-3.5 w-3.5" /> Last edited
              </p>
              <h2 className="mt-1 truncate text-xl font-extrabold">{last.meta.name}</h2>
              <p className="mt-0.5 font-mono text-[12px] text-slate-400">
                {last.config.keyTonic.replace("b", "♭")} {last.config.scale} • {last.config.bpm} BPM • {last.config.timeSignature} • {last.config.mood}
              </p>
            </div>
            <Button onClick={() => openProject(last)}>Reopen project</Button>
          </Card>
        )}

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
            <Sparkles aria-hidden="true" className="h-4 w-4 text-[#6e8bff]" /> Quick start templates
          </h2>
          <p className="-mt-1 mb-3 text-[13px] text-slate-400">New here? Start from a finished example — every sound stays editable.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {QUICK_STARTS.map((t) => (
              <button key={t.id} onClick={() => startQuick(t.id)}
                className="group rounded-xl border border-[#1e2a4a] bg-[#0e1424]/90 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#6e8bff] hover:shadow-[0_0_24px_rgba(110,139,255,0.25)] active:translate-y-0">
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-white">{t.title}</span>
                  <Badge>{t.bpm}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-slate-400">{t.tagline}</p>
                <p className="mt-2 font-mono text-[11px] text-[#aebfff]" title={`Home note ${t.tonic} ${t.scale}, feeling ${t.mood}, intensity ${t.energy} out of 10`}>{t.tonic.replace("b", "♭")} {t.scale} • {t.mood} • energy {t.energy}/10</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
              <FolderOpen aria-hidden="true" className="h-4 w-4 text-[#6e8bff]" /> Recent projects
            </h2>
            <div className="relative ml-auto w-full max-w-xs">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <TextInput placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" aria-label="Search projects" />
            </div>
          </div>
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-white/5" />)}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center text-slate-400">
              {projects.length === 0 ? (
                <>
                  <p className="text-lg font-bold text-white">No projects yet</p>
                  <p className="mt-1 text-sm">Create your first blueprint above, or start from a quick-start template.</p>
                </>
              ) : (
                <p>No projects match “{q}”.</p>
              )}
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => (
                <Card key={p.meta.id} className="group p-4 transition-colors hover:border-[#6e8bff]/60">
                  <div className="flex items-start gap-2">
                    <button onClick={() => openProject(p)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-[15px] font-bold text-white">{p.meta.name}</span>
                      <span className="mt-0.5 block font-mono text-[11.5px] text-slate-400">
                        {p.config.keyTonic.replace("b", "♭")} {p.config.scale} • {p.config.bpm} BPM • {p.chords.chords.slice(0, 4).join(" ")}
                      </span>
                      <span className="mt-1 block text-[11px] text-slate-400">
                        Saved {new Date(p.meta.updatedAt).toLocaleString()}
                      </span>
                    </button>
                    <button onClick={() => duplicate(p)} aria-label={`Duplicate ${p.meta.name}`} title="Duplicate"
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => remove(p.meta.id, p.meta.name)} aria-label={`Delete ${p.meta.name}`} title="Delete this project"
                      className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => openProject(p)}>Open in editor</Button>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 text-sm">
          <Link href="/presets" className="text-[#aebfff] hover:text-white">Browse preset library →</Link>
          <Link href="/projects" className="text-[#aebfff] hover:text-white">Manage saved projects →</Link>
        </div>
      </div>
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="p-8 text-slate-400">Loading dashboard…</div>}>
      <DashboardInner />
    </Suspense>
  );
}
