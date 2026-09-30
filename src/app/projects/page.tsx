// Saved projects: create/rename/duplicate/delete/export/import/reopen.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderOpen, Copy, Trash2, Download, Upload, Pencil } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button, Card, TextInput } from "@/components/ui";
import type { SonicProject } from "@/lib/project-schema";
import { createProject, validateProject } from "@/lib/project-schema";
import { listProjects, saveProject, deleteProject } from "@/lib/storage";
import { useProjectStore } from "@/store/project-store";
import { downloadBlob } from "@/lib/mp3-export";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<SonicProject[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => setProjects(await listProjects());
  useEffect(() => {
    refresh();
  }, []);

  const open = (p: SonicProject) => {
    useProjectStore.getState().load(p);
    router.push(`/studio/${p.meta.id}`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-5 p-4 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><FolderOpen aria-hidden="true" className="h-6 w-6 text-[#6e8bff]" /> Saved Projects</h1>
          <div className="ml-auto flex gap-2">
            <Button
              variant="outline"
              title="Start a blank song"
              onClick={async () => {
                const p = createProject(`Track ${String(projects.length + 1).padStart(2, "0")}`);
                await saveProject(p);
                refresh();
              }}
            >
              New project
            </Button>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#26325a] px-4 text-sm hover:border-[#6e8bff]" title="Bring back a project from a backup file you saved earlier">
              <Upload className="h-4 w-4" /> Restore backup
              <input
                type="file" accept="application/json" className="hidden" aria-label="Restore a project from a backup file"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 5_000_000) {
                    setMsg("That file is far too large to be a song backup (limit 5 MB). Nothing was changed.");
                    e.target.value = "";
                    return;
                  }
                  try {
                    const parsed: unknown = JSON.parse(await f.text());
                    if (validateProject(parsed)) {
                      await saveProject(parsed);
                      setMsg(`“${parsed.meta.name}” restored.`);
                      refresh();
                    } else setMsg("That file doesn't look like a SonicBlueprint backup. Nothing was changed.");
                  } catch {
                    setMsg("Couldn't read that file — it may be damaged. Nothing was changed.");
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
        <p className="text-[13px] text-slate-400">Your songs live in this browser — no account needed. Download a backup file to keep them safe or move them to another device.</p>
        {msg && <p className="text-sm text-slate-400" role="status">{msg}</p>}
        {projects.length === 0 ? (
          <Card className="p-10 text-center text-slate-400">
            <p className="text-lg font-bold text-white">Nothing saved yet</p>
            <p className="mt-1 text-sm">Head to the dashboard and start your first song — it will appear here automatically.</p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {projects.map((p) => (
              <Card key={p.meta.id} className="p-4">
                {editing === p.meta.id ? (
                  <div className="flex gap-2">
                    <TextInput value={name} onChange={(e) => setName(e.target.value)} aria-label="Project name" />
                    <Button size="sm" onClick={async () => {
                      const next = { ...p, meta: { ...p.meta, name: name || p.meta.name, updatedAt: new Date().toISOString() } };
                      await saveProject(next);
                      setEditing(null);
                      refresh();
                    }}>Save</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button onClick={() => open(p)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-bold text-white">{p.meta.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400" title="Musical home note, speed and last saved date">
                        {p.config.keyTonic} {p.config.scale} • {p.config.bpm} BPM • saved {new Date(p.meta.updatedAt).toLocaleString()}
                      </span>
                    </button>
                    <button aria-label={`Rename ${p.meta.name}`} title="Rename this song" className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                      onClick={() => { setEditing(p.meta.id); setName(p.meta.name); }}><Pencil className="h-4 w-4" /></button>
                    <button aria-label={`Make a copy of ${p.meta.name}`} title="Make a copy to try variations safely"
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                      onClick={async () => {
                        await saveProject({ ...p, meta: { ...p.meta, id: `proj_${Math.random().toString(36).slice(2, 9)}`, name: `${p.meta.name} (copy)`, version: 1, updatedAt: new Date().toISOString() } });
                        refresh();
                      }}><Copy className="h-4 w-4" /></button>
                    <button aria-label={`Download a backup of ${p.meta.name}`} title="Download a backup file for this song"
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                      onClick={() => downloadBlob(new Blob([JSON.stringify(p, null, 2)], { type: "application/json" }), `SonicBlueprint_${p.meta.name.replace(/\s+/g, "_")}.json`)}><Download className="h-4 w-4" /></button>
                    <button aria-label={`Delete ${p.meta.name}`} title="Delete this song"
                      className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
                      onClick={async () => { if (confirm(`Delete “${p.meta.name}”? This can't be undone — download a backup first if you might want it back.`)) { await deleteProject(p.meta.id); refresh(); } }}><Trash2 className="h-4 w-4" /></button>
                  </div>
                )}
                <Button size="sm" variant="outline" className="mt-3 w-full" onClick={() => open(p)}>Open in studio</Button>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
