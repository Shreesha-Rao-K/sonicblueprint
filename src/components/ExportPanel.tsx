// Export panel: MP3 / WAV / Stems / MIDI / PDF / JSON — all functional client-side.
"use client";

import { useState } from "react";
import { Download, FileAudio, FileText, Music4, FileJson, Layers, Share2, Settings2 } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { backupProblem, parseBackupFile } from "@/lib/backup";
import { exportMp3, mp3Filename, downloadBlob, type Mp3Bitrate } from "@/lib/mp3-export";
import { exportWav, wavFilename, type WavBitDepth } from "@/lib/wav-export";
import { exportStemsZip, stemZipFilename } from "@/lib/stem-export";
import { exportMidi, midiFilename } from "@/lib/midi-export";
import { exportPdf } from "@/lib/pdf-export";
import { createShareUrl } from "@/lib/share-url";
import { Button, Card, SectionTitle } from "./ui";

export function ExportPanel() {
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [wavBitDepth, setWavBitDepth] = useState<WavBitDepth>(16);
  const [mp3Bitrate, setMp3Bitrate] = useState<Mp3Bitrate>(192);
  const [showMetadata, setShowMetadata] = useState(false);
  const [artist, setArtist] = useState("SonicBlueprint Artist");
  const [album, setAlbum] = useState("SonicBlueprint Sessions");

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
      <div className="flex items-center justify-between">
        <SectionTitle>Export & Share</SectionTitle>
        <button
          type="button"
          onClick={() => setShowMetadata(!showMetadata)}
          className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-200 transition-colors"
          title="Configure ID3 metadata and export quality options"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>{showMetadata ? "Hide Options" : "Export Quality & ID3 Tags"}</span>
        </button>
      </div>
      <p className="mb-3 text-[13px] text-slate-400">
        Take your song out of the studio. Everything is rendered and encoded right here in your browser.
      </p>

      {/* Quality Settings & Metadata Drawer */}
      {showMetadata && (
        <div className="mb-4 rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 text-[12px] space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">WAV Bit Depth</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWavBitDepth(16)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    wavBitDepth === 16
                      ? "bg-indigo-600 text-white font-medium"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  16-bit (CD Standard)
                </button>
                <button
                  type="button"
                  onClick={() => setWavBitDepth(24)}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    wavBitDepth === 24
                      ? "bg-indigo-600 text-white font-medium"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  24-bit (Studio Master)
                </button>
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">MP3 Bitrate</label>
              <div className="flex gap-2">
                {( [128, 192, 320] as const ).map((br) => (
                  <button
                    key={br}
                    type="button"
                    onClick={() => setMp3Bitrate(br)}
                    className={`px-2.5 py-1 rounded text-xs transition-colors ${
                      mp3Bitrate === br
                        ? "bg-indigo-600 text-white font-medium"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    {br} kbps {br === 128 ? "(Draft)" : br === 192 ? "(Standard)" : "(Master)"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-1 border-t border-slate-800">
            <div>
              <label className="block text-slate-400 mb-1">Artist / Performer (ID3 TPE1)</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full rounded bg-slate-950 px-2 py-1 text-slate-200 border border-slate-800 focus:border-indigo-500 focus:outline-none"
                placeholder="Artist name"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Album / Release (ID3 TALB)</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full rounded bg-slate-950 px-2 py-1 text-slate-200 border border-slate-800 focus:border-indigo-500 focus:outline-none"
                placeholder="Album title"
              />
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={busy !== null}
          title={`Uncompressed studio quality ${wavBitDepth}-bit 44.1kHz PCM audio`}
          onClick={() => run("WAV", async () => {
            setMsg(`Rendering ${wavBitDepth}-bit lossless WAV… this can take a minute for long songs.`);
            const blob = await exportWav(project, { bitDepth: wavBitDepth }, (s) => setMsg(s));
            downloadBlob(blob, wavFilename(project.meta.name));
          })}
        >
          <FileAudio className="h-4 w-4" /> {busy === "WAV" ? "Rendering…" : `WAV audio (${wavBitDepth}-bit)`}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          title={`A compressed ${mp3Bitrate} kbps recording of your song with embedded ID3v2 tags`}
          onClick={() => run("MP3", async () => {
            setMsg(`Recording your song (${mp3Bitrate} kbps)… this can take a minute for long songs.`);
            const blob = await exportMp3(
              project,
              {
                bitrate: mp3Bitrate,
                tags: {
                  title: project.meta.name,
                  artist: artist || "SonicBlueprint Artist",
                  album: album || "SonicBlueprint Sessions",
                  genre: project.config.mood || "Electronic",
                },
              },
              (s) => setMsg(s)
            );
            downloadBlob(blob, mp3Filename(project.meta.name));
          })}
        >
          <FileAudio className="h-4 w-4" /> {busy === "MP3" ? "Recording…" : `MP3 (${mp3Bitrate} kbps)`}
        </Button>
        <Button
          variant="outline"
          disabled={busy !== null}
          title={`Individual ${wavBitDepth}-bit WAV tracks for Drums, Bass, Chords, and Melody inside a ZIP archive`}
          onClick={() => run("Stems", async () => {
            setMsg("Rendering 4 isolated stems… this will take a moment.");
            const blob = await exportStemsZip(project, { bitDepth: wavBitDepth }, (p) => setMsg(p.message));
            downloadBlob(blob, stemZipFilename(project.meta.name));
          })}
        >
          <Layers className="h-4 w-4" /> {busy === "Stems" ? "Rendering stems…" : "Stems pack (ZIP)"}
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
        <Button
          variant="outline"
          disabled={busy !== null}
          title="Create a lightweight shareable link with the complete song state embedded"
          onClick={() => run("Share link", async () => {
            const url = await createShareUrl(project);
            if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(url);
              setMsg("Shareable link copied to clipboard! Anyone with this link can open and edit this song.");
            } else {
              setMsg(`Share link: ${url}`);
            }
          })}
        >
          <Share2 className="h-4 w-4" /> {busy === "Share link" ? "Creating link…" : "Share link"}
        </Button>
      </div>
      <div className="mt-3 flex items-start gap-2 text-[12px] text-slate-400" aria-live="polite">
        <Download className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {msg ?? `WAV is the ${wavBitDepth}-bit studio lossless recording. MP3 is the ${mp3Bitrate} kbps recording with ID3 tags. Stems pack (ZIP) exports isolated tracks. MIDI holds editable notes. PDF is the blueprint. Share link embeds the entire song into a zero-backend URL.`}
        </span>
      </div>
      <label className="mt-3 block cursor-pointer rounded-lg border border-dashed border-[#2a3a6b] p-3 text-center text-[13px] text-slate-400 hover:border-[#6e8bff] hover:text-slate-200" title="Restore a project from a backup file you saved earlier">
        Restore from backup file
        <input
          type="file"
          accept="application/json"
          className="sr-only"
          aria-label="Restore a project from a backup file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            if (f.size > 5_000_000) {
              setMsg("That file is far too large to be a song backup (limit 5 MB). Nothing was changed.");
              e.target.value = "";
              return;
            }
            try {
              const text = await f.text();
              const parsed = parseBackupFile(text);
              const problem = backupProblem(parsed);
              if (problem) {
                setMsg(problem);
              } else if (parsed.projects.length > 1) {
                setMsg(`That file holds ${parsed.projects.length} songs — the studio edits one song at a time. Restore it from the Saved Projects page so every song is kept. Nothing was changed.`);
              } else {
                useProjectStore.getState().load(parsed.projects[0]);
                setMsg(`“${parsed.projects[0].meta.name}” loaded. Press Save to keep it in this browser.`);
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
