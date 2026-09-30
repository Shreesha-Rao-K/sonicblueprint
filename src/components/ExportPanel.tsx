// Export panel: MP3 / MIDI / PDF / JSON — all functional client-side.
"use client";

import { useState } from "react";
import { Download, FileAudio, FileText, Music4, FileJson } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { validateProject } from "@/lib/project-schema";
import { exportMp3, mp3Filename, downloadBlob } from "@/lib/mp3-export";
import { exportMidi, midiFilename } from "@/lib/midi-export";
import { exportPdf } from "@/lib/pdf-export";
import { Button, Card, SectionTitle } from "./ui";

export function ExportPanel() {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  if (!project) return null;

  const run = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind);
    setMsg(null);
    try {
      await fn();
      setMsg(`${kind} saved — check your downloads folder.`);
    } catch (e) {
      setMsg(`${kind} didn't work: ${e instanceof Error ? e.message : "unknown error"}. Your project is safe — please try again.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card id="panel-export" className="scroll-mt-20 p-5">
      <SectionTitle>Export & Share</SectionTitle>
      <p className="mb-3 text-[13px] text-slate-400">
        Take your song out of the studio. Everything is made right here in your browser.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={busy !== null}
          title="A finished recording of your song — plays anywhere"
          onClick={() => run("MP3", async () => {
            setMsg("Recording your song… this can take a minute for long songs.");
            const blob = await exportMp3(project, (s) => setMsg(s));
            downloadBlob(blob, mp3Filename(project.meta.name));
          })}
        >
          <FileAudio className="h-4 w-4" /> {busy === "MP3" ? "Recording…" : "MP3 recording"}
        </Button>
        <Button
          variant="outline" disabled={busy !== null}
          title="The editable notes — open in GarageBand, FL Studio, Ableton and more"
          onClick={() => run("MIDI", async () => {
            const blob = await exportMidi(project);
            downloadBlob(blob, midiFilename(project.meta.name));
          })}
        >
          <Music4 className="h-4 w-4" /> MIDI notes
        </Button>
        <Button
          variant="outline" disabled={busy !== null}
          title="A readable document with your chords, instruments and song map"
          onClick={() => run("PDF", async () => {
            const blob = await exportPdf(project);
            const safe = project.meta.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
            downloadBlob(blob, `SonicBlueprint_${safe}_Blueprint.pdf`);
          })}
        >
          <FileText className="h-4 w-4" /> PDF blueprint
        </Button>
        <Button
          variant="outline" disabled={busy !== null}
          title="A backup file you can store, share, or reopen later"
          onClick={() => run("Backup", async () => {
            const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
            const safe = project.meta.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Project";
            downloadBlob(blob, `SonicBlueprint_${safe}.json`);
          })}
        >
          <FileJson className="h-4 w-4" /> Backup file
        </Button>
      </div>
      <div className="mt-3 flex items-start gap-2 text-[12px] text-slate-400" aria-live="polite">
        <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {msg ?? "MP3 is the finished recording. MIDI holds the editable notes for other music apps. PDF is the readable blueprint. The backup file reopens your project anywhere."}
        </span>
      </div>
      <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-[#2a3a6b] p-3 text-center text-[13px] text-slate-400 hover:border-[#6e8bff] hover:text-slate-200" title="Restore a project from a backup file you saved earlier">
        Restore from backup file
        <input
          type="file"
          accept="application/json"
          className="hidden"
          aria-label="Restore a project from a backup file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            // A real project file is a few kilobytes; anything huge is rejected
            // before parsing so a malicious file can't freeze the tab.
            if (f.size > 5_000_000) {
              setMsg("That file is far too large to be a song backup (limit 5 MB). Nothing was changed.");
              e.target.value = "";
              return;
            }
            try {
              const text = await f.text();
              const parsed: unknown = JSON.parse(text);
              // Full structural validation: anything malformed or absurd is
              // refused here so it can never reach rendering or storage.
              if (validateProject(parsed)) {
                useProjectStore.getState().load(parsed);
                setMsg("Backup restored. Press Save to keep it in this browser.");
              } else {
                setMsg("That file doesn't look like a SonicBlueprint backup. Nothing was changed.");
              }
            } catch {
              setMsg("Couldn't read that file — it may be damaged. Nothing was changed.");
            }
            e.target.value = "";
          }}
        />
      </label>
    </Card>
  );
}
