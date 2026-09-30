// Chord + musical setup editor: key, BPM, time sig, mood, progression, visual theory.
"use client";

import { useMemo, useRef, useState } from "react";
import { Play } from "lucide-react";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { CHORD_PROGRESSIONS, resolvePresetChords } from "@/data/chords";
import { MOODS, TIME_SIGNATURES } from "@/data/styles";
import { ALL_KEYS, chordLongName, rootToPc, transposeProgression } from "@/lib/music-theory";
import { getEngine } from "@/lib/audio-engine";
import { Button, Card, Label, SectionTitle, Select, Slider, TextInput, Badge } from "./ui";

export function ChordEditor() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  const chordIndex = useTransportStore((s) => s.chordIndex);
  const [filter, setFilter] = useState<string>("all");
  const [customText, setCustomText] = useState("");
  const taps = useRef<number[]>([]);

  const tapTempo = () => {
    const now = performance.now();
    taps.current = [...taps.current, now].slice(-6);
    if (taps.current.length >= 2) {
      const intervals: number[] = [];
      for (let i = 1; i < taps.current.length; i++) intervals.push(taps.current[i] - taps.current[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avg > 250 && avg < 1200) {
        const bpm = Math.round(60000 / avg);
        update((p) => ({ ...p, config: { ...p.config, bpm: Math.max(50, Math.min(180, bpm)) } }));
      }
      if (taps.current.length >= 6) taps.current = taps.current.slice(-2);
    }
    setTimeout(() => {
      if (performance.now() - (taps.current[taps.current.length - 1] ?? 0) > 2200) taps.current = [];
    }, 2300);
  };

  const list = useMemo(
    () => CHORD_PROGRESSIONS.filter((c) => filter === "all" || c.category === filter),
    [filter]
  );

  if (!project) return null;

  const applyPreset = (id: string) => {
    const preset = CHORD_PROGRESSIONS.find((c) => c.id === id);
    if (!preset) return;
    const chords = resolvePresetChords(preset, project.config.keyTonic);
    update((p) => ({
      ...p,
      chords: { ...p.chords, progressionId: preset.id, chords, beatsPerChord: 4 },
      config: { ...p.config, energy: preset.energy },
      originality: { ...p.originality, presetOnly: false },
    }));
  };

  const applyCustom = () => {
    const chords = customText.split(/[,→>\n]+/).map((s) => s.trim()).filter(Boolean);
    if (chords.length === 0) return;
    update((p) => ({
      ...p,
      chords: { ...p.chords, progressionId: `custom-${Date.now().toString(36)}`, chords },
      originality: { ...p.originality, presetOnly: false },
    }));
  };

  const setKey = (keyLabel: string) => {
    const def = ALL_KEYS.find((k) => k.key === keyLabel);
    if (!def) return;
    update((p) => {
      const fromPc = rootToPc(p.config.keyTonic);
      const toPc = rootToPc(def.tonic);
      const chords = transposeProgression(p.chords.chords, fromPc, toPc);
      return {
        ...p,
        config: { ...p.config, keyTonic: def.tonic, scale: def.scale === "major" ? "major" : "minor" },
        chords: { ...p.chords, chords },
      };
    });
  };

  return (
    <Card id="panel-chords" className="scroll-mt-20 p-5">
      <SectionTitle right={<Badge>{project.chords.chords.length} chords in the loop</Badge>}>Chords & Key</SectionTitle>
      <p className="-mt-1 mb-3 text-[13px] text-slate-400">
        Chords are groups of notes played together — they decide the feeling of your song.
        Pick a ready-made loop below, or type your own. Click any chord to hear it.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="bpm">Tempo — {project.config.bpm} BPM</Label>
            <button
              onClick={tapTempo}
              className="rounded-lg border border-[#26325a] px-3 py-1 text-[12px] font-semibold text-slate-200 hover:border-[#6e8bff] hover:text-white"
              title="Tap along with the beat and the tempo will match your tapping"
            >
              Tap tempo
            </button>
          </div>
          <Slider id="bpm" min={50} max={180} value={project.config.bpm} title="Song speed in beats per minute — higher is faster"
            onChange={(e) => update((p) => ({ ...p, config: { ...p.config, bpm: Number(e.target.value) } }))} />
          <p className="mt-1 text-[12px] text-slate-400">Speed of the song. Slow ballads sit near 70, dance tracks near 125.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor="key">Key</Label>
              <Select id="key" value={`${project.config.keyTonic} ${project.config.scale}`} onChange={(e) => setKey(e.target.value)}
                title="The home note of your song — every chord, bass note and melody follows it automatically">
                {ALL_KEYS.map((k) => (
                  <option key={k.key} value={k.key}>{k.label}</option>
                ))}
              </Select>
              <p className="mt-1 text-[12px] text-slate-400">Home note. Changing it shifts every chord to match.</p>
            </div>
            <div>
              <Label htmlFor="ts">Time signature</Label>
              <Select id="ts" value={project.config.timeSignature}
                title="How beats are grouped — 4/4 fits most pop songs"
                onChange={(e) => update((p) => ({ ...p, config: { ...p.config, timeSignature: e.target.value as typeof p.config.timeSignature } }))}>
                {TIME_SIGNATURES.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
              <p className="mt-1 text-[12px] text-slate-400">Beat grouping. 4/4 fits most songs; 3/4 feels like a waltz.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor="mood">Mood</Label>
              <Select id="mood" value={project.config.mood} onChange={(e) => update((p) => ({ ...p, config: { ...p.config, mood: e.target.value } }))} title="The overall feeling — saved in your blueprint and PDF">
                {MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="bpc">Chord length — {project.chords.beatsPerChord}</Label>
              <Slider id="bpc" min={1} max={8} step={1} value={project.chords.beatsPerChord} title="How long each chord lasts before the next one starts"
                onChange={(e) => update((p) => ({ ...p, chords: { ...p.chords, beatsPerChord: Number(e.target.value) } }))} />
              <p className="mt-1 text-[12px] text-slate-400">Beats each chord lasts. 4 is the classic pop feel.</p>
            </div>
          </div>
        </div>

        <div>
          <Label>Your chord loop (in {project.config.keyTonic.replace("b", "♭")})</Label>
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Chords — tap to hear each one">
            {project.chords.chords.map((c, i) => (
              <button
                key={`${c}-${i}`}
                aria-current={i === chordIndex ? "true" : undefined}
                onClick={() => getEngine().previewChord(c, project.chords.octave)}
                title={`${chordLongName(c)} — click to hear it`}
                className={`rounded-lg border px-3 py-2 text-left transition-all active:translate-y-px ${
                  i === chordIndex
                    ? "border-[#6e8bff] bg-[#6e8bff]/20 text-white shadow-[0_0_14px_rgba(110,139,255,0.4)]"
                    : "border-[#26325a] bg-white/[0.03] text-slate-100 hover:-translate-y-0.5 hover:border-[#6e8bff] hover:shadow-[0_4px_16px_rgba(110,139,255,0.2)]"
                }`}
              >
                <span className="block text-[15px] font-bold">{c.replace("b", "♭")}</span>
                <span className="block text-[11px] text-slate-400">{chordLongName(c)}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[13px] text-slate-400">
            {project.chords.chords.map((c) => chordLongName(c)).join("  →  ")}
          </p>
          <div className="mt-3 flex gap-2">
            <TextInput
              placeholder="Your own chords, e.g. Dm, Bb, F, C"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              aria-label="Type your own chords separated by commas"
              title="Type chord names separated by commas — e.g. Am, F, C, G"
            />
            <Button onClick={applyCustom} title="Replace the loop with your typed chords">Apply</Button>
          </div>
          <p className="mt-1.5 text-[12px] text-slate-400">No theory needed — if it sounds good, it is good. Press play below to hear it in the full song.</p>
        </div>
      </div>

      <div className="mt-5 border-t border-[#1e2a4a] pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Label htmlFor="progfilter">Chord loop library</Label>
          <select id="progfilter" className="h-8 rounded-lg border border-[#26325a] bg-[#0a0e1a] px-2 text-[13px]"
            value={filter} onChange={(e) => setFilter(e.target.value)} title="Show loops for one feeling, or all of them">
            <option value="all">All feelings</option>
            {["emotional","cinematic","dark","uplifting","pop","dramatic","tension","resolution","dreamy","powerful"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="text-[12px] text-slate-400">{list.length} loops — each one already shifted into your key</span>
        </div>
        <p className="mb-2 text-[12px] text-slate-400">
          Roman numerals (like i – VI – III – VII) describe the <em>shape</em> of a loop, independent of key.
          “Easy” loops use common chords; “advanced” ones add surprising twists. Press ▶ on any card to hear it.
        </p>
        <div className="grid max-h-64 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => {
            const resolved = resolvePresetChords(c, project.config.keyTonic);
            const active = project.chords.progressionId === c.id;
            return (
              <div key={c.id} className={`rounded-lg border p-3 text-left ${active ? "border-[#6e8bff] bg-[#6e8bff]/10" : "border-[#22305c] bg-white/[0.02] hover:border-[#6e8bff]/60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold text-white">{c.name}</span>
                  <button
                    className="rounded-full p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    aria-label={`Hear ${c.name}`}
                    title={`Hear ${c.name}`}
                    onClick={() => {
                      const eng = getEngine();
                      resolved.slice(0, 4).forEach((ch, k) => {
                        setTimeout(() => eng.previewChord(ch, project.chords.octave), k * 650);
                      });
                    }}
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-1 font-mono text-[12px] text-[#aebfff]">{resolved.join(" – ").replace(/b/g, "♭")}</div>
                <div className="mt-0.5 text-[11px] text-slate-400">Shape {c.roman} • {c.difficulty === "easy" ? "Easy chords" : c.difficulty === "medium" ? "Some stretch" : "Adventurous"} • {c.bars} bars {c.bars === 1 ? "(building block)" : "(building blocks)"}</div>
                <div className="mt-1 text-[12px] text-slate-400">{c.description}</div>
                <Button size="sm" variant={active ? "default" : "outline"} className="mt-2 w-full" onClick={() => applyPreset(c.id)} title={active ? "This loop is in your song now" : "Replace your loop with these chords"}>
                  {active ? "In your song ✓" : "Use these chords"}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
