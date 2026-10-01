// Settings: engine volume default, data management.
"use client";

import { useState } from "react";
import { Settings as SettingsIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, SectionTitle, Button, Label } from "@/components/ui";
import { useTransportStore } from "@/store/project-store";
import { listProjects, deleteProject } from "@/lib/storage";

export default function SettingsPage() {
  const t = useTransportStore();
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const backUpAll = async () => {
    const all = await listProjects();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SonicBlueprint_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    setMsg(`Backed up ${all.length} song${all.length === 1 ? "" : "s"}. Keep the file somewhere safe — it can be restored from the Saved Projects page.`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[800px] space-y-4 p-4 md:p-8">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><SettingsIcon aria-hidden="true" className="h-6 w-6 text-[#6e8bff]" /> Settings</h1>

        <Card className="p-5">
          <SectionTitle>Sound</SectionTitle>
          <Label htmlFor="defvol">Loudness — {Math.round(t.volume * 100)}%</Label>
          <input id="defvol" type="range" min={0} max={1} step={0.01} value={t.volume} className="w-full" title="How loud songs play"
            onChange={(e) => t.set({ volume: Number(e.target.value) })} />
          <label className="mt-2 flex items-center gap-2 text-sm text-slate-300" title="When on, songs start over automatically at the end">
            <input type="checkbox" checked={t.loop} onChange={() => t.set({ loop: !t.loop })} className="h-4 w-4 accent-[#6e8bff]" />
            Repeat songs automatically
          </label>
        </Card>

        <Card className="p-5">
          <SectionTitle>Your saved songs</SectionTitle>
          <p className="text-[13px] text-slate-400">Projects are stored locally on this device/browser. Use Backup to protect or move your projects — clearing browser data loses them.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" onClick={backUpAll}>
              Back up all songs
            </Button>
            {!confirmingDelete ? (
              <Button
                variant="danger"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete everything
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={backUpAll} title="Download a backup first — you can undo the deletion otherwise">
                  Back up first
                </Button>
                <Button
                  variant="danger"
                  onClick={async () => {
                    if (!confirm("Delete ALL songs on this device/browser? This cannot be undone. If you have no backup file saved elsewhere, choose “Back up first” instead. Really delete everything?")) {
                      setConfirmingDelete(false);
                      return;
                    }
                    const all = await listProjects();
                    for (const p of all) await deleteProject(p.meta.id);
                    setConfirmingDelete(false);
                    setMsg("Everything deleted. A fresh start — create your first song from the dashboard.");
                  }}
                >
                  Yes, delete everything
                </Button>
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                  Keep my songs
                </Button>
              </>
            )}
          </div>
          {msg && <p className="mt-2 text-[13px] text-slate-400" role="status">{msg}</p>}
        </Card>

        <Card className="p-5 text-[13px] leading-relaxed text-slate-400">
          <SectionTitle>About</SectionTitle>
          SonicBlueprint turns your ideas into instrumental songs right in your browser —
          listen instantly, then take home an MP3 recording, editable MIDI notes, or a readable PDF blueprint.
          No account, no uploads: your songs stay on your device.
        </Card>
      </div>
    </AppShell>
  );
}
