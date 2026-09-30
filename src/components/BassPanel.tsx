// Bass + melody panel: styles follow chords automatically, custom gate editor.
"use client";

import { useRef, useState } from "react";
import { useProjectStore } from "@/store/project-store";
import { BASS_STYLES, MELODY_STYLES } from "@/data/styles";
import { Card, Label, SectionTitle, Select, Slider, Badge } from "./ui";
import { cn } from "@/lib/cn";

export function BassPanel() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  if (!project) return null;

  const gateLen = Math.max(4, Math.min(16, project.chords.beatsPerChord * 2));
  const gate: boolean[] =
    project.bass.pattern && project.bass.pattern.length === gateLen
      ? project.bass.pattern
      : Array.from({ length: gateLen }, (_, i) => i % 2 === 0);

  // Roving tabindex for the rhythm grid (mirrors the drum sequencer).
  const [gateFocus, setGateFocus] = useState(0);
  const gateFocusClamped = Math.max(0, Math.min(gate.length - 1, gateFocus));
  const gateRef = useRef<HTMLDivElement>(null);
  const focusGateAt = (i: number) => {
    const next = Math.max(0, Math.min(gate.length - 1, i));
    setGateFocus(next);
    gateRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-gate="${next}"]`)
      ?.focus();
  };
  const onGateKeyDown = (e: React.KeyboardEvent, i: number) => {
    if (e.key === "ArrowRight") { e.preventDefault(); focusGateAt(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); focusGateAt(i - 1); }
    else if (e.key === "Home") { e.preventDefault(); focusGateAt(0); }
    else if (e.key === "End") { e.preventDefault(); focusGateAt(gate.length - 1); }
  };

  return (
    <Card className="p-5">
      <SectionTitle right={<Badge title="Whatever chords you pick, the bass notes follow them">Follows your chords</Badge>}>Bass & Melody</SectionTitle>
      <p className="-mt-1 mb-3 text-[13px] text-slate-400">
        The low end and the tune, built from your chords automatically. Shape the feel here, then press play.
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <Label htmlFor="bassstyle">Bass style</Label>
          <Select id="bassstyle" value={project.bass.styleId} title="How the bass moves under your chords — it always plays matching notes"
            onChange={(e) => update((p) => ({ ...p, bass: { ...p.bass, styleId: e.target.value as typeof p.bass.styleId }, originality: { ...p.originality, presetOnly: e.target.value === "custom" ? false : p.originality.presetOnly } }))}>
            {BASS_STYLES.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </Select>
          <p className="mt-1.5 text-[13px] text-slate-400">
            {BASS_STYLES.find((b) => b.id === project.bass.styleId)?.description}
          </p>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor="bassoct">Pitch range — {project.bass.octave}</Label>
              <Slider id="bassoct" min={0} max={3} step={1} value={project.bass.octave} title="Higher numbers move the bass up; 1 is the classic deep bass"
                onChange={(e) => update((p) => ({ ...p, bass: { ...p.bass, octave: Number(e.target.value) } }))} />
            </div>
            <div>
              <Label htmlFor="bassvol">Bass loudness — {Math.round(project.bass.volume * 100)}%</Label>
              <Slider id="bassvol" min={0} max={1} step={0.01} value={project.bass.volume}
                onChange={(e) => update((p) => ({ ...p, bass: { ...p.bass, volume: Number(e.target.value) } }))} />
            </div>
          </div>
          {(project.bass.styleId === "rhythmic" || project.bass.styleId === "electronic" || project.bass.styleId === "custom") && (
            <div className="mt-3">
              <Label id="bass-gate-label">When the bass plays ({gateLen} moments per chord)</Label>
              <p className="mt-0.5 text-[12px] text-slate-400">Lit squares = the bass plays a note there. Tap to draw your own rhythm.</p>
              <div ref={gateRef} role="group" aria-labelledby="bass-gate-label" aria-describedby="bass-gate-help" className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${gateLen}, minmax(0,1fr))` }}>
                {gate.map((on, i) => (
                  <button
                    key={i}
                    data-gate={i}
                    tabIndex={gateFocusClamped === i ? 0 : -1}
                    onKeyDown={(e) => onGateKeyDown(e, i)}
                    onFocus={() => {
                      if (gateFocus !== i) setGateFocus(i);
                    }}
                    aria-label={`Bass plays at moment ${i + 1} ${on ? "on" : "off"}`}
                    aria-pressed={on}
                    onClick={() => {
                      const next = [...gate];
                      next[i] = !next[i];
                      update((p) => ({ ...p, bass: { ...p.bass, styleId: "custom", pattern: next }, originality: { ...p.originality, presetOnly: false } }));
                    }}
                    className={cn("h-9 rounded-md border transition-all active:scale-95", on ? "border-[#6e8bff] bg-[#6e8bff]" : "border-[#22305c] bg-white/[0.03] hover:bg-white/[0.08]")}
                  />
                ))}
              </div>
              <p id="bass-gate-help" className="mt-1.5 text-[12px] text-slate-400">
                Keyboard: Tab in once, then use ← → to move and Space to switch on or off.
              </p>
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="melstyle">Melody style</Label>
          <Select id="melstyle" value={project.melodyStyle}
            onChange={(e) => update((p) => ({ ...p, melodyStyle: e.target.value, originality: { ...p.originality, presetOnly: false, melodySeed: Math.random().toString(36).slice(2, 10) } }))}>
            {MELODY_STYLES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </Select>
          <p className="mt-1.5 text-[13px] text-slate-400">
            {MELODY_STYLES.find((m) => m.id === project.melodyStyle)?.description}
          </p>
          <div className="mt-3">
            <Label htmlFor="melregen">Tune variation</Label>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-[#22305c] bg-black/40 px-3 py-2 font-mono text-[12px] text-[#aebfff]" title="The recipe ID for this tune — each one sounds different">
                {project.originality.melodySeed}
              </code>
              <button
                id="melregen"
                className="rounded-lg border border-[#26325a] px-3 py-2 text-[13px] hover:border-[#6e8bff]"
                title="Write a brand-new tune over the same chords"
                onClick={() => update((p) => ({ ...p, originality: { ...p.originality, melodySeed: Math.random().toString(36).slice(2, 10), presetOnly: false } }))}
              >
                New tune
              </button>
            </div>
            <p className="mt-1.5 text-[12px] text-slate-400">The tune is written from your key and chords. “New tune” keeps the same chords and writes a fresh melody.</p>
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
            <div>
              <Label htmlFor="energy">Energy — {project.config.energy}/10</Label>
              <Slider id="energy" min={1} max={10} step={1} value={project.config.energy} title="Overall intensity — low is gentle and calm, high is big and driving"
                onChange={(e) => update((p) => ({ ...p, config: { ...p.config, energy: Number(e.target.value) } }))} />
              <p className="mt-1 text-[12px] text-slate-400">How big it feels, from gentle (1) to anthem (10).</p>
            </div>
            <div>
              <Label htmlFor="dyn">Light & shade — {project.config.dynamics}/10</Label>
              <Slider id="dyn" min={1} max={10} step={1} value={project.config.dynamics} title="Contrast between quiet and loud moments — high values make verses breathe and choruses explode"
                onChange={(e) => update((p) => ({ ...p, config: { ...p.config, dynamics: Number(e.target.value) } }))} />
              <p className="mt-1 text-[12px] text-slate-400">Contrast between soft verses and loud choruses.</p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
