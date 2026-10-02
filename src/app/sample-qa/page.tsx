// Sample QA utility: audition bundled multisamples against the legacy
// oscillator recipe and verify the engine end-to-end (bank load + offline
// render). Not linked from the app nav; used for quality checks.
"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Button, Card } from "@/components/ui";
import { SAMPLE_BANKS } from "@/lib/sample-manifest";
import { pickLayerVoices, selectDrumHit } from "@/lib/sample-bank";
import { ensureSampleBanks } from "@/lib/audio-engine";
import { buildSongEvents, renderToAudioBuffer } from "@/lib/audio-engine";
import { detectPhrases, planPhrase, PERFORM_PROFILES } from "@/lib/performance";
import { MIX_DRY, MIX_LEGACY, familyPanScale } from "@/lib/mix";
import { createProject } from "@/lib/project-schema";
import { midiToFreq } from "@/lib/music-theory";

interface Metrics {
  centroidHz: number;
  attackMs: number;
  decayDbPerSec: number;
  peak: number;
}

async function renderSample(url: string, midi: number, seconds: number): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  const data = await (await fetch(url)).arrayBuffer();
  const buf = await ctx.decodeAudioData(data);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.linearRampToValueAtTime(0.8, 0.008);
  g.gain.setValueAtTime(0.8, Math.max(0.01, seconds - 1.2));
  g.gain.exponentialRampToValueAtTime(0.0001, seconds - 0.02);
  src.connect(g);
  g.connect(ctx.destination);
  src.start(0);
  src.stop(seconds);
  return ctx.startRendering();
}

async function renderLegacySynth(midi: number, seconds: number): Promise<AudioBuffer> {
  // The exact pre-upgrade piano recipe: triangle + octave sine, exp envelope.
  const ctx = new OfflineAudioContext(2, Math.ceil(44100 * seconds), 44100);
  const freq = midiToFreq(midi);
  const out = ctx.createGain();
  const mk = (type: OscillatorType, f: number, g0: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.value = g0;
    o.connect(g);
    g.connect(out);
    return o;
  };
  const a = mk("triangle", freq, 0.9);
  const b = mk("sine", freq * 2, 0.25);
  out.gain.setValueAtTime(0.0001, 0);
  out.gain.exponentialRampToValueAtTime(0.8, 0.012);
  out.gain.exponentialRampToValueAtTime(0.0001, Math.min(3.2, seconds - 0.1));
  out.connect(ctx.destination);
  a.start(0);
  b.start(0);
  a.stop(seconds);
  b.stop(seconds);
  return ctx.startRendering();
}

function analyze(buf: AudioBuffer): Metrics {
  const d = buf.getChannelData(0);
  const sr = buf.sampleRate;
  // peak + attack (10-90% of peak on abs envelope)
  let peak = 0;
  for (let i = 0; i < d.length; i += 4) peak = Math.max(peak, Math.abs(d[i]));
  const t10 = d.findIndex((v) => Math.abs(v) > peak * 0.1) / sr;
  const t90 = d.findIndex((v) => Math.abs(v) > peak * 0.9) / sr;
  // decay slope: RMS in 0.5-1s vs 2-2.5s windows
  const rms = (a: number, b: number) => {
    let s = 0;
    let n = 0;
    for (let i = Math.floor(a * sr); i < Math.min(d.length, Math.floor(b * sr)); i += 7) {
      s += d[i] * d[i];
      n++;
    }
    return Math.sqrt(s / Math.max(1, n));
  };
  const r1 = Math.max(1e-6, rms(0.5, 1.0));
  const r2 = Math.max(1e-6, rms(2.0, 2.5));
  // spectral centroid via naive DFT bins on a mid-note window
  const N = 4096;
  const start = Math.floor(0.4 * sr);
  let num = 0;
  let den = 0;
  for (let k = 1; k < N / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n += 4) {
      const v = d[start + n] ?? 0;
      const ph = (2 * Math.PI * k * n) / N;
      re += v * Math.cos(ph);
      im += v * Math.sin(ph);
    }
    const mag = Math.sqrt(re * re + im * im);
    num += (k * sr) / N * mag;
    den += mag;
  }
  return {
    centroidHz: Math.round(den > 0 ? num / den : 0),
    attackMs: Math.round(Math.max(0, t90 - t10) * 1000),
    decayDbPerSec: Math.round(((20 * Math.log10(r1 / r2)) / 1.5) * 10) / 10,
    peak: Math.round(peak * 1000) / 1000,
  };
}

const CASES = [
  { label: "Piano C4", bank: "grand-piano", midi: 60, note: 9 },
  { label: "Violin A3", bank: "violin-ensemble", midi: 57, note: 5 },
  { label: "Cello C2", bank: "cello", midi: 36, note: 7 },
  { label: "Trumpet F4", bank: "trumpet", midi: 65, note: 8 },
  { label: "French Horn C3", bank: "french-horn", midi: 48, note: 8 },
  { label: "Flute A4", bank: "flute", midi: 69, note: 5 },
  { label: "Clarinet D4", bank: "clarinet", midi: 62, note: 6 },
  { label: "Harp G3", bank: "harp", midi: 55, note: 8 },
];

const VELOCITIES = [0.2, 0.6, 0.9];

function layerDesc(bankId: string, noteIdx: number, vel: number): string {
  const def = SAMPLE_BANKS[bankId];
  const note = def.notes[noteIdx];
  const voices = pickLayerVoices(note.layers, vel);
  return voices
    .map((v) => {
      const parts = note.layers[v.layer].url.split("/");
      const shown = parts.slice(-2).join("/");
      return `${shown}@${Math.round(v.weight * 100)}%`;
    })
    .join(" + ");
}

export default function SampleQAPage() {
  const [rows, setRows] = useState<Record<string, Partial<{ sample: Metrics; legacy: Metrics }> | string>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [e2e, setE2e] = useState<string>("starting…");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const AC = window.AudioContext;
        const ctx = new AC();
        await ctx.resume();
        if (live) setE2e("audio ready, loading banks…");
        const { failed } = await ensureSampleBanks(
          ["grand-piano", "violin-ensemble", "cello", "trumpet", "acoustic-drums"],
          ctx
        );
        if (live) setE2e(`banks loaded (failed: ${failed.join(", ") || "none"}), rendering…`);
        // End-to-end offline render through the real engine path (same code
        // as MP3 export): a 4-bar piano + drums miniature.
        const p = createProject("QA miniature");
        p.arrangement = [
          { id: "s1", name: "VERSE", bars: 4, energy: 6, instruments: [] },
        ];
        const buf0 = await renderToAudioBuffer(p);
        const summarize = (buf: AudioBuffer) => {
          const dd = buf.getChannelData(0);
          let peak = 0;
          let sum = 0;
          for (let i = 0; i < dd.length; i += 16) {
            const v = Math.abs(dd[i]);
            if (v > peak) peak = v;
            sum += v * v;
          }
          const rms = Math.sqrt(sum / Math.ceil(dd.length / 16));
          return `peak ${peak.toFixed(3)}, rms ${rms.toFixed(4)}`;
        };
        // A/B/C mix comparison on the identical miniature (dry / previous /
        // new mix). Numbers only; musical judgment needs ears.
        const lines = [
          `banks failed: [${failed.join(", ") || "none"}]`,
          `C new mix: ${buf0.duration.toFixed(1)}s, ${summarize(buf0)}`,
        ];
        const t0 = performance.now();
        for (const [name, mix] of [["A dry", MIX_DRY], ["B previous", MIX_LEGACY]] as const) {
          const buf = await renderToAudioBuffer(p, undefined, mix);
          lines.push(`${name}: ${summarize(buf)}`);
        }
        const healthy = lines.every((l) => !l.includes("NaN"));
        // Humanize OFF/SUBTLE/NATURAL/EXPRESSIVE on the identical miniature: mean timing
        // wander proves feel without touching composition (same event counts).
        const ref = buildSongEvents({ ...p, config: { ...p.config, humanize: "off" } });
        for (const feel of ["subtle", "natural", "expressive"] as const) {
          const s = buildSongEvents({ ...p, config: { ...p.config, humanize: feel } });
          let wander = 0;
          for (let i = 0; i < s.notes.length; i++) {
            wander += Math.abs(s.notes[i].time - ref.notes[i].time);
          }
          lines.push(
            `feel ${feel}: ${s.notes.length} notes (ref ${ref.notes.length}), mean wander ${((wander / Math.max(1, s.notes.length)) * 1000).toFixed(2)}ms`
          );
        }
        if (live) {
          setE2e(
            lines.join(" | ") + ` | 3 variants in ${((performance.now() - t0) / 1000).toFixed(1)}s` + (healthy ? "" : " (SUSPICIOUS)")
          );
        }
        await ctx.close();
      } catch (e) {
        if (live) setE2e(`E2E FAILED: ${e instanceof Error ? e.message : e}`);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const runOne = async (key: string, bankId: string, noteIdx: number, midi: number, vel: number, legacy: boolean) => {
    setRows((r) => ({ ...r, [key]: "measuring…" }));
    try {
      const def = SAMPLE_BANKS[bankId];
      const note = def.notes[noteIdx];
      const primary = pickLayerVoices(note.layers, vel)[0];
      const url = note.layers[primary.layer].url;
      const buf = legacy ? await renderLegacySynth(midi, 3) : await renderSample(url, midi, 3);
      const m = analyze(buf);
      setRows((r) => {
        const prev = r[key];
        const base = typeof prev === "object" ? prev : ({} as { sample?: Metrics; legacy?: Metrics });
        return { ...r, [key]: { ...base, [legacy ? "legacy" : "sample"]: m } };
      });
    } catch (e) {
      setRows((r) => ({ ...r, [key]: `FAILED: ${e instanceof Error ? e.message : e}` }));
    }
  };

  const listen = async (key: string, bankId: string, noteIdx: number, vel: number) => {
    setPlaying(key);
    try {
      const def = SAMPLE_BANKS[bankId];
      const note = def.notes[noteIdx];
      const primary = pickLayerVoices(note.layers, vel)[0];
      const url = note.layers[primary.layer].url;
      const AC = window.AudioContext;
      const ctx = new AC();
      await ctx.resume();
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await ctx.decodeAudioData(data);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      src.stop(ctx.currentTime + Math.min(3, buf.duration));
      setTimeout(() => {
        void ctx.close();
        setPlaying(null);
      }, 3200);
    } catch {
      setPlaying(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[900px] space-y-4 p-4 md:p-8">
        <h1 className="text-2xl font-extrabold">Sample QA</h1>
        <p className="text-[13px] text-slate-400">
          Renders each multisample vs the legacy oscillator recipe offline and reports honest proxies:
          spectral centroid (richer harmonics read higher), attack time, natural decay slope, peak.
          Press Listen to audition the actual file with your ears — numbers never prove musical quality.
        </p>
        <p className="text-[13px] text-slate-400">
          Banks in manifest: {Object.keys(SAMPLE_BANKS).join(", ")}.
        </p>
        <Card className="p-4">
          <p className="font-bold text-white">Audio Realism V2 — bank registry (factual metadata)</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full font-mono text-[11px] text-slate-300">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pr-3">bank</th>
                  <th className="pr-3">articulation</th>
                  <th className="pr-3">notes</th>
                  <th className="pr-3">layers/note</th>
                  <th className="pr-3">range</th>
                  <th className="pr-3">license</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(SAMPLE_BANKS).map(([id, def]) => (
                  <tr key={id} className="border-t border-[#1e2a4a]">
                    <td className="py-1 pr-3 text-white">{id}</td>
                    <td className="pr-3">{def.articulation}</td>
                    <td className="pr-3">{def.notes.length}</td>
                    <td className="pr-3">{def.notes.length > 0 ? def.notes[0].layers.length : 0}</td>
                    <td className="pr-3">
                      {def.notes.length > 0
                        ? `${def.notes[0].midi}–${def.notes[def.notes.length - 1].midi}`
                        : def.kind === "drums"
                          ? Object.keys(def.rows ?? {}).join(",")
                          : "—"}
                    </td>
                    <td>{id === "grand-piano" ? "CC-BY-3.0" : "CC0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-400">
            Spatial profile (pan scale): bass 0.3 (near center), everything else 1.0
            {["piano", "bass", "strings"].map((s) => ` ${s}=${familyPanScale(s)}`).join(",")}.
            Room sends are per-family data in mix.ts, never an obvious echo.
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-bold text-white">Humanization Off / Subtle / Natural / Expressive (computed live)</p>
          <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-slate-300">
            {(() => {
              const demo = createProject("QA feel");
              demo.arrangement = [{ id: "s1", name: "VERSE", bars: 4, energy: 6, instruments: [] }];
              const ref = buildSongEvents({ ...demo, config: { ...demo.config, humanize: "off" } });
              return (["subtle", "natural", "expressive"] as const).map((feel) => {
                const s = buildSongEvents({ ...demo, config: { ...demo.config, humanize: feel } });
                let wander = 0;
                for (let i = 0; i < s.notes.length; i++) {
                  wander += Math.abs(s.notes[i].time - ref.notes[i].time);
                }
                const moved = s.notes.filter((n, i) => n.time !== ref.notes[i].time).length;
                return (
                  <span key={feel} className="block">
                    {feel}: {s.notes.length} notes (ref {ref.notes.length}), mean wander{" "}
                    {((wander / Math.max(1, s.notes.length)) * 1000).toFixed(2)}ms, {moved} notes moved
                  </span>
                );
              });
            })()}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-400">
            Same composition in all four; only performance timing/velocity differ. Subtle keeps exact timing.
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-bold text-white">Human Performer V3 (computed live)</p>
          <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-slate-300">
            {(() => {
              const demo: { time: number; midi: number; dur: number; vol: number }[] = [
                [0, 60], [0.5, 62], [1.0, 64], [1.5, 65], [2.0, 67], [2.5, 69], [3.0, 67], [3.5, 65],
              ].map(([time, midi]) => ({ time, midi, dur: 0.45, vol: 0.7 }));
              const phrases = detectPhrases(
                demo.map((n) => n.time),
                demo.map((n) => n.midi),
                1.5
              );
              const ph = phrases[0];
              const lines = [
                `demo phrase: ${ph.count} notes, peak at note ${ph.peakIdx + 1}, span ${(ph.end - ph.start).toFixed(1)}s`,
              ];
              for (const level of ["natural", "expressive"] as const) {
                const scale = level === "expressive" ? 1.5 : 1;
                const out = demo.map((n) => ({ ...n }));
                planPhrase(out, { ...ph }, 0, 4242, PERFORM_PROFILES["strings"], { seed: 4242, beatSec: 0.5, sections: [{ start: 0, energy: 6 }], scale }, Infinity);
                const vols = out.map((n) => n.vol);
                const peak = vols.indexOf(Math.max(...vols));
                lines.push(
                  `${level}: peak note ${peak + 1}, end vol ${vols[vols.length - 1].toFixed(3)} (start ${vols[0].toFixed(3)})`
                );
              }
              return lines.map((l) => (
                <span key={l} className="block">
                  {l}
                </span>
              ));
            })()}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-400">
            Phrase arc (rise → peak → release) replaces independent per-note jitter. Deterministic for the demo seed.
          </p>
        </Card>
        <Card className="p-4">
          <p className="font-bold text-white">Engine end-to-end (bank load + offline render)</p>
          <p className="mt-1 font-mono text-[12px] text-slate-300" data-testid="e2e">{e2e}</p>
        </Card>
        <Card className="p-4">
          <p className="font-bold text-white">Drum round-robin (deterministic selection)</p>
          <p className="mt-1 font-mono text-[11.5px] leading-relaxed text-slate-300">
            {["kick", "snare", "tom", "perc"].map((row) => {
              const groups = SAMPLE_BANKS["acoustic-drums"].rows![row];
              const seq = [0, 1, 2, 3].map((rr) => {
                const hit = selectDrumHit(groups, 0.85, rr)!;
                return groups[hit.group].urls[hit.variation].split("/").pop();
              });
              return (
                <span key={row} className="block">
                  {row}: {seq.join(" → ")}
                </span>
              );
            })}
          </p>
          <p className="mt-1 text-[11.5px] text-slate-400">
            Same (row, velocity, hit #) always picks the same take — realtime and export agree.
          </p>
        </Card>
        {CASES.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white">{c.label}</span>
              <span className="ml-auto flex flex-wrap gap-2">
                {VELOCITIES.map((v) => {
                  const key = `${c.label} @${v}`;
                  return (
                    <span key={key} className="inline-flex items-center gap-1.5 rounded-lg border border-[#26325a] px-2 py-1">
                      <span className="font-mono text-[11px] text-slate-400" title={layerDesc(c.bank, c.note, v)}>
                        vel {v}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => runOne(key, c.bank, c.note, c.midi, v, false)}>Measure</Button>
                      <Button size="sm" onClick={() => listen(key, c.bank, c.note, v)}>{playing === key ? "…" : "Listen"}</Button>
                    </span>
                  );
                })}
                <Button size="sm" variant="outline" onClick={() => runOne(`${c.label} legacy`, c.bank, c.note, c.midi, 0.8, true)}>Measure legacy</Button>
              </span>
            </div>
            <p className="mt-1 font-mono text-[11px] text-slate-400">
              {VELOCITIES.map((v) => `vel ${v}: ${layerDesc(c.bank, c.note, v)}`).join(" · ")}
            </p>
            {VELOCITIES.map((v) => {
              const key = `${c.label} @${v}`;
              const row = rows[key] ?? rows[`${c.label} legacy`];
              if (row === undefined) return null;
              return (
                <pre key={key} className="mt-1 overflow-x-auto font-mono text-[11.5px] text-slate-300">
                  {key}: {typeof row === "string" ? row : JSON.stringify(row, null, 1)}
                </pre>
              );
            })}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
