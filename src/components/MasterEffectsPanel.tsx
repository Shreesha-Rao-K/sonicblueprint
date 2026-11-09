// Master effects panel: Reverb, Delay, and 3-Band EQ controls with live audio updates.
"use client";

import { Sliders, RotateCcw } from "lucide-react";
import { useProjectStore } from "@/store/project-store";
import { getEngine } from "@/lib/audio-engine";
import {
  defaultMasterFx,
  type MasterFxConfig,
} from "@/lib/audio-effects";
import { Card, SectionTitle, Button } from "./ui";
import { announce } from "@/lib/a11y-announcer";

export function MasterEffectsPanel() {
  const project = useProjectStore((s) => s.project);
  const updateProject = useProjectStore((s) => s.update);

  if (!project) return null;
  const fx = project.effects ?? defaultMasterFx();

  const setFx = (patch: Partial<MasterFxConfig>) => {
    const next: MasterFxConfig = {
      reverb: { ...fx.reverb, ...(patch.reverb ?? {}) },
      delay: { ...fx.delay, ...(patch.delay ?? {}) },
      eq: { ...fx.eq, ...(patch.eq ?? {}) },
      modulation: { ...(fx.modulation ?? defaultMasterFx().modulation), ...(patch.modulation ?? {}) },
      compressor: { ...(fx.compressor ?? defaultMasterFx().compressor), ...(patch.compressor ?? {}) },
    };
    updateProject((p) => ({ ...p, effects: next }));
    getEngine().updateEffects(next);
  };

  const handleReset = () => {
    const reset = defaultMasterFx();
    updateProject((p) => ({ ...p, effects: reset }));
    getEngine().updateEffects(reset);
  };

  const hasAnyActive =
    fx.reverb.enabled ||
    fx.delay.enabled ||
    fx.eq.enabled ||
    Boolean(fx.modulation?.enabled) ||
    Boolean(fx.compressor?.enabled);

  return (
    <Card id="panel-effects" className="scroll-mt-20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <SectionTitle>Master Effects</SectionTitle>
          <span className="text-[11px] font-mono text-slate-400">
            {hasAnyActive ? "Active" : "Neutral Bypass"}
          </span>
        </div>
        {hasAnyActive && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-[11px] h-7 px-2 text-slate-400 hover:text-white"
            title="Reset all effects to neutral bypass"
          >
            <RotateCcw className="h-3 w-3 mr-1" /> Reset
          </Button>
        )}
      </div>

      <p className="mb-4 text-[13px] text-slate-400">
        Shape your master sound with space, echo, and tonal balance. Adjustments apply live in real-time and export to your finished audio.
      </p>

      <div className="space-y-4">
        {/* ── 3-Band EQ ── */}
        <div className="rounded-lg border border-[#2a3a6b]/50 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#6e8bff]" />
              <span className="text-[13px] font-semibold text-slate-200">3-Band Master EQ</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fx.eq.enabled}
              aria-label={`3-Band Master EQ ${fx.eq.enabled ? "on" : "bypassed"}`}
              onClick={() => {
                const nextState = !fx.eq.enabled;
                setFx({ eq: { ...fx.eq, enabled: nextState } });
                announce(`3-Band Master EQ ${nextState ? "enabled" : "bypassed"}`);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                fx.eq.enabled
                  ? "bg-[#6e8bff] text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {fx.eq.enabled ? "ON" : "BYPASS"}
            </button>
          </div>

          <div className={`grid grid-cols-3 gap-3 pt-2 text-[12px] transition-opacity ${fx.eq.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Low</span>
                <span className="font-mono">{fx.eq.lowGain > 0 ? `+${fx.eq.lowGain}` : fx.eq.lowGain} dB</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                disabled={!fx.eq.enabled}
                value={fx.eq.lowGain}
                onChange={(e) => setFx({ eq: { ...fx.eq, lowGain: parseFloat(e.target.value) } })}
                aria-label="EQ Low Gain"
                aria-valuetext={`${fx.eq.lowGain > 0 ? `+${fx.eq.lowGain}` : fx.eq.lowGain} dB`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Mid</span>
                <span className="font-mono">{fx.eq.midGain > 0 ? `+${fx.eq.midGain}` : fx.eq.midGain} dB</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                disabled={!fx.eq.enabled}
                value={fx.eq.midGain}
                onChange={(e) => setFx({ eq: { ...fx.eq, midGain: parseFloat(e.target.value) } })}
                aria-label="EQ Mid Gain"
                aria-valuetext={`${fx.eq.midGain > 0 ? `+${fx.eq.midGain}` : fx.eq.midGain} dB`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>High</span>
                <span className="font-mono">{fx.eq.highGain > 0 ? `+${fx.eq.highGain}` : fx.eq.highGain} dB</span>
              </div>
              <input
                type="range"
                min={-12}
                max={12}
                step={0.5}
                disabled={!fx.eq.enabled}
                value={fx.eq.highGain}
                onChange={(e) => setFx({ eq: { ...fx.eq, highGain: parseFloat(e.target.value) } })}
                aria-label="EQ High Gain"
                aria-valuetext={`${fx.eq.highGain > 0 ? `+${fx.eq.highGain}` : fx.eq.highGain} dB`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {/* ── Stereo Delay ── */}
        <div className="rounded-lg border border-[#2a3a6b]/50 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-200">Stereo Delay</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fx.delay.enabled}
              aria-label={`Stereo Delay ${fx.delay.enabled ? "on" : "bypassed"}`}
              onClick={() => {
                const nextState = !fx.delay.enabled;
                setFx({ delay: { ...fx.delay, enabled: nextState } });
                announce(`Stereo Delay ${nextState ? "enabled" : "bypassed"}`);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                fx.delay.enabled
                  ? "bg-[#6e8bff] text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {fx.delay.enabled ? "ON" : "BYPASS"}
            </button>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[12px] transition-opacity ${fx.delay.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Time</span>
                <span className="font-mono">{Math.round(fx.delay.time * 1000)} ms</span>
              </div>
              <input
                type="range"
                min={0.05}
                max={0.8}
                step={0.02}
                disabled={!fx.delay.enabled}
                value={fx.delay.time}
                onChange={(e) => setFx({ delay: { ...fx.delay, time: parseFloat(e.target.value) } })}
                aria-label="Delay Time"
                aria-valuetext={`${Math.round(fx.delay.time * 1000)} milliseconds`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Feedback</span>
                <span className="font-mono">{Math.round(fx.delay.feedback * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                disabled={!fx.delay.enabled}
                value={fx.delay.feedback}
                onChange={(e) => setFx({ delay: { ...fx.delay, feedback: parseFloat(e.target.value) } })}
                aria-label="Delay Feedback"
                aria-valuetext={`${Math.round(fx.delay.feedback * 100)} percent`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Mix</span>
                <span className="font-mono">{Math.round(fx.delay.mix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                disabled={!fx.delay.enabled}
                value={fx.delay.mix}
                onChange={(e) => setFx({ delay: { ...fx.delay, mix: parseFloat(e.target.value) } })}
                aria-label="Delay Mix"
                aria-valuetext={`${Math.round(fx.delay.mix * 100)} percent`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
          </div>
        </div>

        {/* ── Master Reverb ── */}
        <div className="rounded-lg border border-[#2a3a6b]/50 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-200">Master Reverb</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={fx.reverb.enabled}
              aria-label={`Master Reverb ${fx.reverb.enabled ? "on" : "bypassed"}`}
              onClick={() => {
                const nextState = !fx.reverb.enabled;
                setFx({ reverb: { ...fx.reverb, enabled: nextState } });
                announce(`Master Reverb ${nextState ? "enabled" : "bypassed"}`);
              }}
              className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                fx.reverb.enabled
                  ? "bg-[#6e8bff] text-slate-950 font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {fx.reverb.enabled ? "ON" : "BYPASS"}
            </button>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[12px] transition-opacity ${fx.reverb.enabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Decay</span>
                <span className="font-mono">{fx.reverb.decay.toFixed(1)} s</span>
              </div>
              <input
                type="range"
                min={0.5}
                max={4.0}
                step={0.1}
                disabled={!fx.reverb.enabled}
                value={fx.reverb.decay}
                onChange={(e) => setFx({ reverb: { ...fx.reverb, decay: parseFloat(e.target.value) } })}
                aria-label="Reverb Decay"
                aria-valuetext={`${fx.reverb.decay.toFixed(1)} seconds`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Tone</span>
                <span className="font-mono">{Math.round(fx.reverb.tone / 1000)} kHz</span>
              </div>
              <input
                type="range"
                min={1000}
                max={10000}
                step={500}
                disabled={!fx.reverb.enabled}
                value={fx.reverb.tone}
                onChange={(e) => setFx({ reverb: { ...fx.reverb, tone: parseFloat(e.target.value) } })}
                aria-label="Reverb Tone"
                aria-valuetext={`${Math.round(fx.reverb.tone / 1000)} kilohertz`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
            <div>
              <div className="flex justify-between text-slate-400 mb-1">
                <span>Mix</span>
                <span className="font-mono">{Math.round(fx.reverb.mix * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={0.8}
                step={0.05}
                disabled={!fx.reverb.enabled}
                value={fx.reverb.mix}
                onChange={(e) => setFx({ reverb: { ...fx.reverb, mix: parseFloat(e.target.value) } })}
                aria-label="Reverb Mix"
                aria-valuetext={`${Math.round(fx.reverb.mix * 100)} percent`}
                className="w-full accent-[#6e8bff] disabled:opacity-40"
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
