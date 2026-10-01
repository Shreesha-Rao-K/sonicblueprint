// Saved versions: deliberate snapshots ("Save Version"), separate from undo.
// Creating a version never changes the song; restoring asks first and stays
// undoable, so an accidental restore can be undone with Ctrl+Z.
"use client";

import { useState } from "react";
import { History, RotateCcw, Trash2 } from "lucide-react";
import { Card, Button, TextInput } from "./ui";
import { useProjectStore } from "@/store/project-store";

export function VersionPanel() {
  const project = useProjectStore((s) => s.project);
  const [label, setLabel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  if (!project) return null;
  const versions = [...(project.versions ?? [])].reverse();

  const save = async () => {
    await useProjectStore.getState().saveVersion(label || undefined);
    setLabel("");
    setMsg("Version saved — your song is unchanged.");
  };

  const restore = (id: string, name: string) => {
    if (
      !confirm(
        `Restore this version? Your current project state will be replaced. Consider saving the current state as a version first. (Version: ${name})`
      )
    ) {
      return;
    }
    if (useProjectStore.getState().restoreVersion(id)) {
      setMsg(`“${name}” restored. Press Save to keep it, or undo to go back.`);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete version “${name}”? The rest of your song is untouched.`)) return;
    await useProjectStore.getState().deleteVersion(id);
    setMsg(`Version “${name}” deleted.`);
  };

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-bold text-white">
        <History aria-hidden="true" className="h-4 w-4 text-[#6e8bff]" /> Saved versions
      </h2>
      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">
        Keep named snapshots of big moments — “Bigger Chorus”, “Final” — while you keep experimenting.
      </p>
      <div className="mt-3 flex gap-2">
        <TextInput
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Name this version (optional)"
          aria-label="Version name"
          maxLength={60}
        />
        <Button size="sm" onClick={save} title="Keep a snapshot of the song exactly as it is now">
          Save Version
        </Button>
      </div>
      {msg && (
        <p className="mt-2 text-[12.5px] text-slate-400" role="status">
          {msg}
        </p>
      )}
      {versions.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-slate-400">No versions yet — your first snapshot will appear here.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {versions.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-2 rounded-lg border border-[#22305c] bg-white/[0.02] px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-bold text-white">{v.label}</p>
                <p className="font-mono text-[11px] text-slate-400">
                  v{v.versionNumber} • {new Date(v.createdAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => restore(v.id, v.label)}
                aria-label={`Restore version ${v.label}`}
                title="Replace the current song with this snapshot (you confirm first, and undo still works)"
                className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                onClick={() => remove(v.id, v.label)}
                aria-label={`Delete version ${v.label}`}
                title="Delete this snapshot"
                className="rounded p-1.5 text-slate-400 hover:bg-red-500/10 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
