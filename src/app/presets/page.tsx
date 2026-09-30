// Preset library: browsable data-driven catalog (moods, chords, drums, instruments).
"use client";

import { useMemo, useState } from "react";
import { Library, Play } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, TextInput } from "@/components/ui";
import { CHORD_PROGRESSIONS } from "@/data/chords";
import { DRUM_PRESETS } from "@/data/drums";
import { INSTRUMENT_DEFS, MOODS, QUICK_STARTS } from "@/data/styles";
import { getEngine } from "@/lib/audio-engine";

export default function PresetsPage() {
  const [q, setQ] = useState("");
  const [mood, setMood] = useState("all");

  const chords = useMemo(
    () =>
      CHORD_PROGRESSIONS.filter(
        (c) =>
          (mood === "all" || c.moodTags.includes(mood)) &&
          (q === "" || `${c.name} ${c.roman} ${c.chordsInC.join(" ")} ${c.description}`.toLowerCase().includes(q.toLowerCase()))
      ),
    [q, mood]
  );
  const drums = useMemo(
    () => DRUM_PRESETS.filter((d) => q === "" || `${d.name} ${d.category} ${d.description}`.toLowerCase().includes(q.toLowerCase())),
    [q]
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Library aria-hidden="true" className="h-6 w-6 text-[#6e8bff]" /> Preset Library</h1>
          <div className="ml-auto flex gap-2">
            <TextInput placeholder="Search presets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search presets" className="w-56" />
            <select value={mood} onChange={(e) => setMood(e.target.value)} aria-label="Filter by mood"
              className="h-10 rounded-lg border border-[#26325a] bg-[#0a0e1a] px-3 text-sm">
              <option value="all">All moods</option>
              {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
            Song starters ({QUICK_STARTS.length})
          </h2>
          <p className="mb-2 text-[13px] text-slate-400">Finished examples — open one from the dashboard and every sound stays editable.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_STARTS.map((t) => (
              <Link key={t.id} href="/dashboard" className="rounded-xl border border-[#1e2a4a] bg-[#0e1424]/90 p-3 transition-all hover:-translate-y-0.5 hover:border-[#6e8bff] hover:shadow-[0_8px_24px_rgba(110,139,255,0.2)]" title={`Start a song like this: ${t.tagline}`}>
                <span className="font-bold text-white">{t.title}</span>
                <span className="mt-0.5 block text-[13px] text-slate-400">{t.tagline}</span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
            Chord loops ({chords.length})
          </h2>
          <p className="mb-2 text-[13px] text-slate-400">Ready-made chord groups. Press ▶ to hear each one, then use it from the studio.</p>
          {chords.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-slate-400">Nothing matches your search — try fewer words or a different feeling.</Card>
          ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {chords.map((c) => (
              <Card key={c.id} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{c.name}</span>
                  <Badge>{c.category}</Badge>
                  <button
                    aria-label={`Hear ${c.name}`}
                    title={`Hear ${c.name}`}
                    className="ml-auto rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      const eng = getEngine();
                      c.chordsInC.slice(0, 4).forEach((ch, k) => setTimeout(() => eng.previewChord(ch, 3), k * 650));
                    }}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 font-mono text-[12px] text-[#aebfff]">{c.chordsInC.join(" – ")} <span className="text-slate-400">({c.roman})</span></p>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{c.description}</p>
                <p className="mt-1 text-[11px] text-slate-400">{c.moodTags.join(" • ")} — {c.difficulty === "easy" ? "easy chords" : c.difficulty === "medium" ? "some stretch" : "adventurous"}, {c.bars} bars, intensity {c.energy}/10</p>
              </Card>
            ))}
          </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
            Drum patterns ({drums.length})
          </h2>
          <p className="mb-2 text-[13px] text-slate-400">Ready-made drum grooves. Load one in the studio, then tap squares to reshape it.</p>
          {drums.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-slate-400">Nothing matches your search — try fewer words.</Card>
          ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {drums.map((d) => (
              <Card key={d.id} className="p-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{d.name}</span>
                  <Badge>{d.category}</Badge>
                  <span className="ml-auto font-mono text-[11px] text-slate-400" title="Time slots per bar and a comfortable speed range">{d.steps} steps • {d.bpmSuggestion[0]}–{d.bpmSuggestion[1]} BPM</span>
                </div>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{d.description}</p>
              </Card>
            ))}
          </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
            Sounds ({INSTRUMENT_DEFS.length})
          </h2>
          <p className="mb-2 text-[13px] text-slate-400">Every sound you can layer into a song. Mix and match them freely in the studio.</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {INSTRUMENT_DEFS.map((d) => (
              <Card key={`${d.group}-${d.name}`} className="p-3">
                <p className="font-bold text-white">{d.name}</p>
                <p className="text-[12px] text-slate-400">{d.group} • {d.defaultRole}</p>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{d.description}</p>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
