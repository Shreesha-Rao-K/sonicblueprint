// Originality panel: honest in-project checks + required disclaimer.
"use client";

import { ShieldCheck, ShieldAlert, Info, Flag } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { checkOriginality, ORIGINALITY_DISCLAIMER } from "@/lib/originality";
import { Card, SectionTitle, Label } from "./ui";

export function OriginalityPanel() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  if (!project) return null;
  const findings = checkOriginality(project);
  const o = project.originality;

  const toggle = (key: "usesImportedRecording" | "usesCommercialSample" | "usesCopiedMelody" | "repeatedMelody") =>
    update((p) => ({ ...p, originality: { ...p.originality, [key]: !p.originality[key] } }));

  const icon = (level: string) =>
    level === "pass" ? <ShieldCheck aria-hidden="true" className="h-4 w-4 text-emerald-400" />
    : level === "info" ? <Info aria-hidden="true" className="h-4 w-4 text-sky-400" />
    : level === "warn" ? <ShieldAlert aria-hidden="true" className="h-4 w-4 text-amber-400" />
    : <Flag aria-hidden="true" className="h-4 w-4 text-red-400" />;

  const levelWord: Record<string, string> = {
    pass: "Good",
    info: "Tip",
    warn: "Check this",
    flag: "Action needed",
  };

  return (
    <Card className="p-5">
      <SectionTitle>Is My Song Original?</SectionTitle>
      <p className="mb-3 text-[13px] text-slate-400">
        A quick self-review of how your song was made. Tick the boxes below if any apply to you.
      </p>
      <div className="grid gap-2">
        {findings.map((f, i) => (
          <div key={i} className="flex gap-2.5 rounded-lg border border-[#1e2a4a] bg-white/[0.015] p-3">
            <span className="mt-0.5 shrink-0">{icon(f.level)}</span>
            <div>
              <div className="text-[13px] font-bold text-slate-100">
                <span className="mr-2 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{levelWord[f.level] ?? f.level}</span>
                {f.title}
              </div>
              <div className="mt-0.5 text-[13px] text-slate-400">{f.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid gap-2 border-t border-[#1e2a4a] pt-3 text-[13px] sm:grid-cols-2">
        <p className="text-[12px] text-slate-400 sm:col-span-2">Tick anything you used from outside this project:</p>
        {(
          [
            ["usesImportedRecording", "I used someone else's recording"],
            ["usesCommercialSample", "I used a bought/downloaded sample"],
            ["usesCopiedMelody", "I pasted a tune from elsewhere"],
            ["repeatedMelody", "My tune repeats itself a lot"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-slate-300" title="Honest answers keep your music safe to share">
            <input type="checkbox" checked={o[key]} onChange={() => toggle(key)} className="h-4 w-4 accent-[#6e8bff]" />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-3">
        <Label htmlFor="orignotes">Your notes (saved with the project)</Label>
        <textarea
          id="orignotes"
          rows={2}
          value={o.notes ?? ""}
          onChange={(e) => update((p) => ({ ...p, originality: { ...p.originality, notes: e.target.value } }))}
          placeholder="e.g. melody rewritten in bridge; drums programmed from scratch…"
          className="mt-1 w-full rounded-lg border border-[#26325a] bg-[#0a0e1a] p-2.5 text-[13px] text-slate-100 placeholder:text-slate-400"
        />
      </div>
      <p className="mt-3 rounded-lg bg-white/[0.03] p-3 text-[12px] leading-relaxed text-slate-400">{ORIGINALITY_DISCLAIMER}</p>
    </Card>
  );
}
