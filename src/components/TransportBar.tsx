// Transport bar: play/pause/stop/loop/volume + position + analyser visuals.
"use client";

import { useEffect, useRef } from "react";
import { Play, Pause, Square, SkipBack, Repeat, Volume2, VolumeX } from "lucide-react";
import { getEngine } from "@/lib/audio-engine";
import { useProjectStore, useTransportStore } from "@/store/project-store";
import { Button } from "./ui";
import { cn } from "@/lib/cn";

function fmt(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function TransportBar({ fromSectionId }: { fromSectionId?: string | null }) {
  const project = useProjectStore((s) => s.project);
  const t = useTransportStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The level meter only exists on large screens — skip its work elsewhere.
  const meterOn = useRef(true);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      meterOn.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const drawFrame = (staticBars: boolean) => {
      const c = canvasRef.current;
      const eng = getEngine();
      const an = eng.analyserNode;
      if (!c) return;
      const g = c.getContext("2d");
      if (!g) return;
      const data = an ? new Uint8Array(an.frequencyBinCount) : null;
      if (data && an && !staticBars) an.getByteFrequencyData(data);
      g.clearRect(0, 0, c.width, c.height);
      const n = 48;
      const bw = c.width / n;
      for (let i = 0; i < n; i++) {
        const v = data ? data[Math.floor((i / n) * data.length * 0.7)] / 255 : 0.15;
        const h = Math.max(2, v * c.height);
        g.fillStyle = t.playing && !staticBars ? "#6e8bff" : "#2a3a6b";
        g.fillRect(i * bw + 1, c.height - h, bw - 2, h);
      }
    };
    if (reduceMotion) {
      // No animation: render one calm static frame.
      drawFrame(true);
      return;
    }
    const draw = () => {
      if (meterOn.current) drawFrame(false);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [t.playing]);

  if (!project) return null;
  const eng = getEngine();

  const doPlay = async () => {
    await eng.play(project, {
      loop: t.loop,
      fromSectionId: fromSectionId ?? null,
      onTick: (s) => {
        // throttle: zustand set is cheap; engine ticks every 25ms but fields rarely change much
        useTransportStore.getState().set({
          playing: s.playing,
          positionSec: s.positionSec,
          durationSec: s.durationSec,
          chordIndex: s.currentChordIndex,
          sectionIndex: s.currentSectionIndex,
        });
        if (!s.playing) {
          // ended
        }
      },
    });
    eng.setVolume(t.volume);
    eng.setMuted(t.muted);
  };

  const toggle = async () => {
    if (eng.isPlaying()) {
      eng.pause();
      t.set({ playing: false, positionSec: eng.position() });
    } else {
      if (t.positionSec > 1 && t.positionSec < t.durationSec - 0.3) {
        await eng.resume();
        t.set({ playing: true });
      } else {
        await doPlay();
        t.set({ playing: true });
      }
    }
  };

  const stop = () => {
    eng.stop(true);
    t.set({ playing: false, positionSec: 0, chordIndex: 0, sectionIndex: 0 });
  };

  const progress = t.durationSec > 0 ? Math.min(1, t.positionSec / t.durationSec) : 0;

  return (
    <div className="glass sticky top-0 z-30 border-b border-[#1e2a4a] px-4 py-2.5" role="region" aria-label="Playback controls">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Back to the start" title="Back to the start" onClick={stop}>
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            aria-label={t.playing ? "Pause" : "Play the song"}
            title={t.playing ? "Pause" : "Play the song"}
            onClick={toggle}
            className="h-11 w-11 rounded-full"
          >
            {t.playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </Button>
          <Button size="icon" variant="ghost" aria-label="Stop" title="Stop playback" onClick={stop}>
            <Square className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label={t.loop ? "Stop repeating" : "Repeat the song"}
            title={t.loop ? "Stop repeating" : "Repeat the song from the start"}
            aria-pressed={t.loop}
            onClick={() => t.set({ loop: !t.loop })}
            className={cn(t.loop && "bg-[#6e8bff]/20 text-white")}
          >
            <Repeat className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-w-[140px] font-mono text-[13px] text-slate-200" aria-live="off" title="Elapsed time and total length">
          {fmt(t.positionSec)} <span className="text-slate-400">/ {fmt(t.durationSec)}</span>
          <span className="ml-3 text-slate-400" title="Beats per minute — the speed of the song">{project.config.bpm} BPM</span>
        </div>

        <div className="relative h-2 min-w-[160px] flex-1 overflow-hidden rounded-full bg-[#1a2340]" role="progressbar" aria-label="How far through the song" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#6e8bff] to-[#a78bfa]" style={{ width: `${progress * 100}%` }} />
        </div>

        <canvas ref={canvasRef} width={160} height={28} className="hidden h-7 w-40 opacity-90 lg:block" aria-hidden="true" />

        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" aria-label={t.muted ? "Turn sound on" : "Mute"} title={t.muted ? "Turn sound on" : "Mute"} onClick={() => { const m = !t.muted; t.set({ muted: m }); eng.setMuted(m); }}>
            {t.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={t.volume}
            aria-label="Loudness"
            title="How loud everything plays"
            className="w-24"
            onChange={(e) => {
              const v = Number(e.target.value);
              t.set({ volume: v });
              eng.setVolume(v);
            }}
          />
        </div>
      </div>
    </div>
  );
}
