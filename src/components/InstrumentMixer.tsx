// Instrument mixer: multi-enable, volume/pan/octave/role/style/pattern.
"use client";

import { useProjectStore } from "@/store/project-store";
import { INSTRUMENT_GROUPS, INSTRUMENT_DEFS } from "@/data/styles";
import type { InstrumentSlot } from "@/lib/project-schema";
import { uid } from "@/lib/project-schema";
import { Card, Label, SectionTitle, Select, Slider, Badge } from "./ui";

export function InstrumentMixer() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  if (!project) return null;

  const patch = (id: string, fn: (i: InstrumentSlot) => InstrumentSlot) =>
    update((p) => ({ ...p, instruments: p.instruments.map((i) => (i.id === id ? fn(i) : i)) }));

  const addInstrument = (group: string) => {
    const def = INSTRUMENT_DEFS.find((d) => d.group === group) ?? INSTRUMENT_DEFS[0];
    const slot: InstrumentSlot = {
      id: uid("inst"), group: def.group, name: def.name, enabled: true,
      volume: def.defaultVolume, pan: 0, octave: 0, role: def.defaultRole, style: "default", patternVariant: "block",
    };
    update((p) => ({ ...p, instruments: [...p.instruments, slot], originality: { ...p.originality, presetOnly: false } }));
  };

  return (
    <Card className="p-5">
      <SectionTitle
        right={<Badge title="How many sounds are switched on right now">{project.instruments.filter((i) => i.enabled).length} / {project.instruments.length} on</Badge>}
      >
        Instruments
      </SectionTitle>
      <p className="mb-3 text-[13px] text-slate-400">
        Sounds are layered together — everything switched on plays at the same time.
        Add sounds with the buttons, flip the switch to mute one, and press play to hear the mix.
      </p>
      <div className="mb-4 flex flex-wrap gap-2">
        {INSTRUMENT_GROUPS.map((g) => (
          <button
            key={g.id}
            onClick={() => addInstrument(g.id)}
            title={`Add ${g.label.toLowerCase()} — ${g.hint}`}
            aria-label={`Add ${g.label} sound`}
            className="rounded-full border border-[#26325a] px-3 py-1.5 text-[12px] text-slate-300 hover:border-[#6e8bff] hover:text-white"
          >
            + {g.label}
          </button>
        ))}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {project.instruments.map((inst) => (
          <div key={inst.id} className={`rounded-xl border p-4 ${inst.enabled ? "border-[#2a3a6b] bg-white/[0.02]" : "border-[#1a2340] opacity-60"}`}>
            <div className="flex items-center gap-3">
              <button
                role="switch"
                aria-checked={inst.enabled}
                aria-label={`${inst.name} enabled`}
                onClick={() => patch(inst.id, (i) => ({ ...i, enabled: !i.enabled }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${inst.enabled ? "bg-[#6e8bff]" : "bg-[#22305c]"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${inst.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-white">
                  {inst.name}{" "}
                  {INSTRUMENT_DEFS.some((d) => d.group === inst.group && d.name === inst.name && d.sampleBank) ? (
                    <span className="ml-1 inline-block rounded-full border border-[#2a3a6b] bg-[#6e8bff]/10 px-1.5 py-px align-middle text-[10px] font-medium normal-case tracking-normal text-[#aebfff]" title="Plays from recorded instrument samples">
                      Sampled
                    </span>
                  ) : null}
                </div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400">{inst.group} • {inst.role}</div>
              </div>
              <button
                className="rounded px-2 py-1 text-[12px] text-red-300/80 hover:bg-red-500/10 hover:text-red-200"
                aria-label={`Remove ${inst.name}`}
                onClick={() => update((p) => ({ ...p, instruments: p.instruments.filter((x) => x.id !== inst.id) }))}
              >
                Remove
              </button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
              <div>
                <Label>Loudness — {Math.round(inst.volume * 100)}%</Label>
                <Slider min={0} max={1} step={0.01} value={inst.volume} aria-label={`${inst.name} loudness`} title="How loud this sound is in the mix"
                  onChange={(e) => patch(inst.id, (i) => ({ ...i, volume: Number((e.target as HTMLInputElement).value) }))} />
              </div>
              <div>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <Label>Left–right</Label>
                  <span className="font-mono text-[11px] text-slate-400" aria-hidden="true">{inst.pan === 0 ? "Center" : inst.pan > 0 ? `Right ${Math.round(inst.pan * 100)}` : `Left ${Math.round(-inst.pan * 100)}`}</span>
                </div>
                <Slider min={-1} max={1} step={0.05} value={inst.pan} aria-label={`${inst.name} left-right position, currently ${inst.pan === 0 ? "center" : inst.pan > 0 ? `right ${Math.round(inst.pan * 100)}` : `left ${Math.round(-inst.pan * 100)}`}`} title="Slide left or right to place the sound across your speakers"
                  onChange={(e) => patch(inst.id, (i) => ({ ...i, pan: Number((e.target as HTMLInputElement).value) }))} />
              </div>
              <div>
                <Label>Pitch range — {inst.octave >= 0 ? `+${inst.octave}` : inst.octave}</Label>
                <Slider min={-2} max={2} step={1} value={inst.octave} aria-label={`${inst.name} pitch range`} title="Shift this sound higher (+) or lower (−)"
                  onChange={(e) => patch(inst.id, (i) => ({ ...i, octave: Number((e.target as HTMLInputElement).value) }))} />
              </div>
              <div>
                <Label htmlFor={`role-${inst.id}`}>Job in the song</Label>
                <Select id={`role-${inst.id}`} value={inst.role} title="What this sound does: chords, tune, ripple, background, bass, lead or texture"
                  onChange={(e) => patch(inst.id, (i) => ({ ...i, role: e.target.value as InstrumentSlot["role"] }))}>
                  {[
                    ["chords", "Chords"],
                    ["melody", "Tune"],
                    ["arp", "Ripple"],
                    ["pad", "Background"],
                    ["bass", "Bass"],
                    ["lead", "Lead"],
                    ["texture", "Texture"],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor={`style-${inst.id}`}>Character</Label>
                <Select id={`style-${inst.id}`} value={inst.style} title="Tonal flavor, from soft to bright"
                  onChange={(e) => patch(inst.id, (i) => ({ ...i, style: e.target.value }))}>
                  {["default", "soft", "bright", "warm", "dark", "pluck", "legato", "sub"].map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </div>
              <div>
                <Label htmlFor={`pattern-${inst.id}`} title="All together = full chords at once • One by one = notes in sequence • Rising = notes climbing upward • Held = long smooth notes • Tune = follows the melody • Home note = steady bass notes">Playing style</Label>
                <Select id={`pattern-${inst.id}`} value={inst.patternVariant} title="How the notes are played: all together, one by one, rising, held, tune or home note"
                  onChange={(e) => patch(inst.id, (i) => ({ ...i, patternVariant: e.target.value }))}>
                  {[
                    ["block", "All together"],
                    ["broken", "One by one"],
                    ["arp-up", "Rising"],
                    ["sustain", "Held"],
                    ["melody", "Tune"],
                    ["root", "Home note"],
                  ].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>
      {project.instruments.length === 0 && (
        <p className="text-sm text-slate-400">No instruments. Add one above — at least one enabled instrument is needed for audible preview.</p>
      )}
    </Card>
  );
}
