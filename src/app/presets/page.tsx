// Preset library: browsable data-driven catalog (moods, chords, drums, instruments).
"use client";

import { useMemo, useState } from "react";
import { Library, Play } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, Badge, TextInput } from "@/components/ui";
import { CHORD_PROGRESSIONS, PROGRESSION_CATEGORIES } from "@/data/chords";
import { DRUM_CATEGORIES, DRUM_PRESETS } from "@/data/drums";
import {
  INSTRUMENT_DEFS,
  INSTRUMENT_GROUPS,
  MOODS,
  QUICK_STARTS,
} from "@/data/styles";
import {
  ENERGY_BANDS,
  TEMPO_BANDS,
  filterChordProgressions,
  filterDrumPresets,
  filterInstruments,
  filterQuickStarts,
} from "@/lib/preset-filters";
import { getEngine } from "@/lib/audio-engine";

const CHORD_DIFFICULTIES = ["easy", "medium", "advanced"] as const;
const INSTRUMENT_ROLES = ["chords", "melody", "arp", "pad", "bass", "lead", "texture"] as const;

const selectClass =
  "h-10 rounded-lg border border-[#26325a] bg-[#0a0e1a] px-3 text-sm";

export default function PresetsPage() {
  const [q, setQ] = useState("");
  const [mood, setMood] = useState("all");
  const [energy, setEnergy] = useState("all");
  const [tempo, setTempo] = useState("all");
  const [chordCat, setChordCat] = useState("all");
  const [chordDiff, setChordDiff] = useState("all");
  const [drumCat, setDrumCat] = useState("all");
  const [soundGroup, setSoundGroup] = useState("all");
  const [soundRole, setSoundRole] = useState("all");

  const hasFilters =
    q !== "" || mood !== "all" || energy !== "all" || tempo !== "all" ||
    chordCat !== "all" || chordDiff !== "all" || drumCat !== "all" ||
    soundGroup !== "all" || soundRole !== "all";

  const reset = () => {
    setQ("");
    setMood("all");
    setEnergy("all");
    setTempo("all");
    setChordCat("all");
    setChordDiff("all");
    setDrumCat("all");
    setSoundGroup("all");
    setSoundRole("all");
  };

  const starters = useMemo(
    () => filterQuickStarts(QUICK_STARTS, { q, mood, energy, tempo }),
    [q, mood, energy, tempo]
  );
  const chords = useMemo(
    () => filterChordProgressions(CHORD_PROGRESSIONS, { q, category: chordCat, mood, energy, difficulty: chordDiff }),
    [q, chordCat, mood, energy, chordDiff]
  );
  const drums = useMemo(
    () => filterDrumPresets(DRUM_PRESETS, { q, category: drumCat, tempo }),
    [q, drumCat, tempo]
  );
  const sounds = useMemo(
    () => filterInstruments(INSTRUMENT_DEFS, { q, group: soundGroup, role: soundRole }),
    [q, soundGroup, soundRole]
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1100px] space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Library aria-hidden="true" className="h-6 w-6 text-[#6e8bff]" /> Preset Library</h1>
          <p className="w-full text-[13px] text-slate-400" aria-live="polite">
            Showing {starters.length + chords.length + drums.length + sounds.length} of{" "}
            {QUICK_STARTS.length + CHORD_PROGRESSIONS.length + DRUM_PRESETS.length + INSTRUMENT_DEFS.length} presets
            {hasFilters ? <> <button onClick={reset} className="ml-2 underline decoration-[#6e8bff] underline-offset-2 hover:text-white">Clear filters</button></> : null}
          </p>
          <div className="flex w-full flex-wrap gap-2">
            <TextInput placeholder="Search presets…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search presets" className="w-56" />
            <select value={mood} onChange={(e) => setMood(e.target.value)} aria-label="Filter by mood"
              className={selectClass}>
              <option value="all">All moods</option>
              {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={energy} onChange={(e) => setEnergy(e.target.value)} aria-label="Filter by energy"
              className={selectClass}>
              <option value="all">All energy levels</option>
              {ENERGY_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            <select value={tempo} onChange={(e) => setTempo(e.target.value)} aria-label="Filter by tempo"
              className={selectClass}>
              <option value="all">Any tempo</option>
              {TEMPO_BANDS.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
            {hasFilters ? (
              <button onClick={reset} className="h-10 rounded-lg border border-[#26325a] px-3 text-sm text-slate-200 hover:border-[#6e8bff] hover:text-white">
                Reset
              </button>
            ) : null}
          </div>
        </div>

        <section>
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
            Song starters ({starters.length} of {QUICK_STARTS.length})
          </h2>
          <p className="mb-2 text-[13px] text-slate-400">Finished examples — open one from the dashboard and every sound stays editable.</p>
          {starters.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-slate-400">No song starters match — try clearing a filter.</Card>
          ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {starters.map((t) => (
              <Link key={t.id} href="/dashboard" className="rounded-xl border border-[#1e2a4a] bg-[#0e1424]/90 p-3 transition-all hover:-translate-y-0.5 hover:border-[#6e8bff] hover:shadow-[0_8px_24px_rgba(110,139,255,0.2)]" title={`Start a song like this: ${t.tagline}`}>
                <span className="font-bold text-white">{t.title}</span>
                <span className="mt-0.5 block text-[13px] text-slate-400">{t.tagline}</span>
                <span className="mt-1 block font-mono text-[11px] text-slate-400">{t.bpm} BPM • {t.mood} • energy {t.energy}/10</span>
              </Link>
            ))}
          </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
              Chord loops ({chords.length} of {CHORD_PROGRESSIONS.length})
            </h2>
            <span className="ml-auto flex gap-2">
              <select value={chordCat} onChange={(e) => setChordCat(e.target.value)} aria-label="Filter chord loops by style"
                className={`${selectClass} h-9 text-[13px]`}>
                <option value="all">All styles</option>
                {PROGRESSION_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={chordDiff} onChange={(e) => setChordDiff(e.target.value)} aria-label="Filter chord loops by difficulty"
                className={`${selectClass} h-9 text-[13px]`}>
                <option value="all">Any difficulty</option>
                {CHORD_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </span>
          </div>
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
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
              Drum patterns ({drums.length} of {DRUM_PRESETS.length})
            </h2>
            <span className="ml-auto">
              <select value={drumCat} onChange={(e) => setDrumCat(e.target.value)} aria-label="Filter drum patterns by style"
                className={`${selectClass} h-9 text-[13px]`}>
                <option value="all">All styles</option>
                {DRUM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
          </div>
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
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.16em] text-slate-300">
              Sounds ({sounds.length} of {INSTRUMENT_DEFS.length})
            </h2>
            <span className="ml-auto flex gap-2">
              <select value={soundGroup} onChange={(e) => setSoundGroup(e.target.value)} aria-label="Filter sounds by instrument"
                className={`${selectClass} h-9 text-[13px]`}>
                <option value="all">All instruments</option>
                {INSTRUMENT_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
              <select value={soundRole} onChange={(e) => setSoundRole(e.target.value)} aria-label="Filter sounds by musical role"
                className={`${selectClass} h-9 text-[13px]`}>
                <option value="all">Any role</option>
                {INSTRUMENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </span>
          </div>
          <p className="mb-2 text-[13px] text-slate-400">Every sound you can layer into a song. Mix and match them freely in the studio.</p>
          {sounds.length === 0 ? (
            <Card className="p-6 text-center text-[13px] text-slate-400">No sounds match — try a different instrument or role.</Card>
          ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sounds.map((d) => (
              <Card key={`${d.group}-${d.name}`} className="p-3">
                <p className="font-bold text-white">{d.name}</p>
                <p className="text-[12px] text-slate-400">{d.group} • {d.defaultRole}</p>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{d.description}</p>
              </Card>
            ))}
          </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
