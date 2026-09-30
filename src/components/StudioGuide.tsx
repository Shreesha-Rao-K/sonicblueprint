// First-run onboarding: 4 plain-language steps, dismissible (remembered per browser).
"use client";

import { useState } from "react";
import { X, MousePointerClick, SlidersHorizontal, ListMusic, Share2 } from "lucide-react";

const KEY = "sb:guide-dismissed";

const STEPS = [
  { icon: MousePointerClick, title: "1 · Pick chords", text: "Choose a chord loop you like. Tap any chord to hear it.", href: "#panel-chords" },
  { icon: SlidersHorizontal, title: "2 · Shape the sound", text: "Try drums, bass and instruments. Everything plays together.", href: "#panel-drums" },
  { icon: ListMusic, title: "3 · Arrange parts", text: "Build intro, verses and a big chorus in Song Structure.", href: "#panel-structure" },
  { icon: Share2, title: "4 · Listen & share", text: "Press play up top, then export an MP3, MIDI or PDF.", href: "#panel-export" },
];

export function StudioGuide() {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (dismissed) return null;

  const hide = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode — just hide for this visit */
    }
    setDismissed(true);
  };

  return (
    <div className="rounded-xl border border-[#2a3a6b] bg-gradient-to-br from-[#101736] to-[#0a0e1a] p-4" role="region" aria-label="Getting started guide">
      <div className="flex items-start gap-3">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((s) => (
            <a key={s.title} href={s.href} className="group flex gap-2.5 rounded-lg p-1 transition-colors hover:bg-white/[0.04]">
              <s.icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-[#6e8bff]" />
              <div>
                <p className="text-[13px] font-bold text-white group-hover:underline">{s.title}</p>
                <p className="text-[12.5px] leading-snug text-slate-400">{s.text}</p>
              </div>
            </a>
          ))}
        </div>
        <button
          onClick={hide}
          aria-label="Hide this guide"
          title="Hide this guide"
          className="rounded-lg border border-[#26325a] p-1.5 text-slate-400 hover:border-[#6e8bff] hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
