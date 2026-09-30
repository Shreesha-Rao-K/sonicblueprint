// Mix Layers: enable/disable the four musical layers without touching settings.
// Switches flow through store.update, so toggles participate in undo/redo,
// persistence, and the shared rendering pipeline (preview, MP3, MIDI, PDF).
"use client";

import { useProjectStore } from "@/store/project-store";
import { LAYER_IDS, getLayers, type LayerId } from "@/lib/project-schema";
import { Card, SectionTitle, Badge } from "./ui";
import { cn } from "@/lib/cn";

const LAYER_META: Record<LayerId, { label: string; hint: string }> = {
  chords: { label: "Chords", hint: "Piano, pads, strings, guitar and other chord sounds" },
  drums: { label: "Drums", hint: "Kick, snare, hats and the full percussion grid" },
  bass: { label: "Bass", hint: "Bassline following your chord roots" },
  melody: { label: "Melody", hint: "Generated tune on plucks and synth leads" },
};

export function LayerToggles() {
  const project = useProjectStore((s) => s.project);
  const update = useProjectStore((s) => s.update);
  if (!project) return null;
  const layers = getLayers(project);
  const onCount = LAYER_IDS.filter((id) => layers[id]).length;

  const setLayer = (id: LayerId, on: boolean) =>
    update((p) => ({
      ...p,
      layers: { ...getLayers(p), [id]: on },
    }));

  return (
    <Card className="p-5">
      <SectionTitle
        right={<Badge title="How many layers are currently included">{onCount} / 4 on</Badge>}
      >
        Mix Layers
      </SectionTitle>
      <p className="mb-3 text-[13px] text-slate-400">
        Choose which layers play. Turning one off never deletes its settings — switch it back on anytime.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {LAYER_IDS.map((id) => {
          const on = layers[id];
          const meta = LAYER_META[id];
          return (
            <div
              key={id}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                on ? "border-[#2a3a6b] bg-white/[0.02]" : "border-[#1a2340] bg-white/[0.008]"
              )}
            >
              <button
                role="switch"
                aria-checked={on}
                aria-label={`${meta.label} layer ${on ? "on" : "off"}`}
                title={`${meta.label}: ${on ? "included in playback and exports — click to mute" : "muted, settings kept — click to include"}`}
                onClick={() => setLayer(id, !on)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                  on ? "bg-[#6e8bff]" : "bg-[#22305c]"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                    on ? "left-[22px]" : "left-0.5"
                  )}
                />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-white">{meta.label}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-px text-[10px] font-bold uppercase tracking-wider",
                      on ? "bg-[#6e8bff]/20 text-[#aebfff]" : "bg-white/5 text-slate-500"
                    )}
                  >
                    {on ? "On" : "Off"}
                  </span>
                </div>
                <div className="truncate text-[12px] text-slate-400" title={meta.hint}>
                  {on ? meta.hint : "Muted — excluded from playback & exports"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
