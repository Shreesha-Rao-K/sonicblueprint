// Professional Stereo Audio VU Meter
// Features DIN PPM / IEC ballistics: fast attack, logarithmic decay, 1.2s peak hold, and clip detection.
"use client";

import { useEffect, useRef, useState } from "react";
import { getEngine } from "@/lib/audio-engine";
import { useTransportStore } from "@/store/project-store";
import {
  updateVuBallistics,
  updatePeakHold,
  linearToDb,
  dbToMeterNorm,
  type PeakHoldState,
} from "@/lib/sequencer-kinetics";
import { cn } from "@/lib/cn";

export interface VuMeterProps {
  orientation?: "horizontal" | "vertical" | undefined;
  className?: string | undefined;
  showLabels?: boolean | undefined;
}

export function VuMeter({
  orientation = "horizontal",
  className,
  showLabels = true,
}: VuMeterProps) {
  const playing = useTransportStore((s) => s.playing);
  const volume = useTransportStore((s) => s.volume);

  const [meterL, setMeterL] = useState({ rms: 0, peak: 0, clip: false });
  const [meterR, setMeterR] = useState({ rms: 0, peak: 0, clip: false });

  const ballisticsRef = useRef({
    linearL: 0,
    linearR: 0,
    peakHoldL: { peak: 0, holdTimeRemaining: 0 } as PeakHoldState,
    peakHoldR: { peak: 0, holdTimeRemaining: 0 } as PeakHoldState,
    lastTime: 0,
    clippedL: false,
    clippedR: false,
  });

  useEffect(() => {
    let raf = 0;
    const SILENCE_THRESHOLD = 0.0005; // ~ -66 dBFS, well below the -48 dBFS visual floor

    const state = ballisticsRef.current;
    state.lastTime = 0; // Reset timestamp so dt starts clean upon wake

    // If transport is idle and meters are already resting at zero, do not start loop
    const isAlreadySilent =
      !playing &&
      state.linearL < SILENCE_THRESHOLD &&
      state.linearR < SILENCE_THRESHOLD &&
      state.peakHoldL.peak < SILENCE_THRESHOLD &&
      state.peakHoldR.peak < SILENCE_THRESHOLD;

    if (isAlreadySilent) {
      return;
    }

    const tick = (now: number) => {
      if (!state.lastTime) state.lastTime = now;
      const dt = Math.max(0.001, Math.min(0.1, (now - state.lastTime) / 1000));
      state.lastTime = now;

      let targetL = 0;
      let targetR = 0;

      if (playing) {
        const eng = getEngine();
        const an = eng.analyserNode;
        if (an) {
          const buffer = new Uint8Array(an.frequencyBinCount);
          an.getByteTimeDomainData(buffer);

          let sumSquares = 0;
          let maxDev = 0;
          for (let i = 0; i < buffer.length; i++) {
            const norm = (buffer[i] - 128) / 128;
            sumSquares += norm * norm;
            const abs = Math.abs(norm);
            if (abs > maxDev) maxDev = abs;
          }
          const rms = Math.sqrt(sumSquares / buffer.length);
          // Scale by transport volume
          targetL = Math.min(1.2, rms * 2.2 * volume);
          targetR = Math.min(1.2, maxDev * 1.8 * volume);
        } else {
          // Fallback simulation when no live node
          targetL = 0.45 * volume;
          targetR = 0.42 * volume;
        }
      }

      // Update DIN PPM ballistics
      state.linearL = updateVuBallistics(state.linearL, targetL, dt, 0.008, 20);
      state.linearR = updateVuBallistics(state.linearR, targetR, dt, 0.008, 20);

      state.peakHoldL = updatePeakHold(state.peakHoldL, state.linearL, dt, 1.2);
      state.peakHoldR = updatePeakHold(state.peakHoldR, state.linearR, dt, 1.2);

      // Check if levels have decayed to silence during idle state
      if (
        !playing &&
        state.linearL < SILENCE_THRESHOLD &&
        state.linearR < SILENCE_THRESHOLD &&
        state.peakHoldL.peak < SILENCE_THRESHOLD &&
        state.peakHoldR.peak < SILENCE_THRESHOLD
      ) {
        state.linearL = 0;
        state.linearR = 0;
        state.peakHoldL = { peak: 0, holdTimeRemaining: 0 };
        state.peakHoldR = { peak: 0, holdTimeRemaining: 0 };
        state.lastTime = 0;

        setMeterL((prev) => (prev.rms === 0 && prev.peak === 0 ? prev : { rms: 0, peak: 0, clip: state.clippedL }));
        setMeterR((prev) => (prev.rms === 0 && prev.peak === 0 ? prev : { rms: 0, peak: 0, clip: state.clippedR }));

        // Terminate loop cleanly without requesting next frame
        return;
      }

      const dbL = linearToDb(state.linearL);
      const dbR = linearToDb(state.linearR);
      const peakDbL = linearToDb(state.peakHoldL.peak);
      const peakDbR = linearToDb(state.peakHoldR.peak);

      if (dbL >= -0.1 || peakDbL >= -0.1) state.clippedL = true;
      if (dbR >= -0.1 || peakDbR >= -0.1) state.clippedR = true;

      const normL = dbToMeterNorm(dbL, -48, 3);
      const normPeakL = dbToMeterNorm(peakDbL, -48, 3);
      const normR = dbToMeterNorm(dbR, -48, 3);
      const normPeakR = dbToMeterNorm(peakDbR, -48, 3);

      setMeterL((prev) =>
        Math.abs(prev.rms - normL) < 0.002 &&
        Math.abs(prev.peak - normPeakL) < 0.002 &&
        prev.clip === state.clippedL
          ? prev
          : { rms: normL, peak: normPeakL, clip: state.clippedL }
      );

      setMeterR((prev) =>
        Math.abs(prev.rms - normR) < 0.002 &&
        Math.abs(prev.peak - normPeakR) < 0.002 &&
        prev.clip === state.clippedR
          ? prev
          : { rms: normR, peak: normPeakR, clip: state.clippedR }
      );

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, volume]);

  const resetClip = () => {
    ballisticsRef.current.clippedL = false;
    ballisticsRef.current.clippedR = false;
    ballisticsRef.current.peakHoldL = { peak: 0, holdTimeRemaining: 0 };
    ballisticsRef.current.peakHoldR = { peak: 0, holdTimeRemaining: 0 };
    setMeterL((prev) => ({ ...prev, clip: false, peak: 0 }));
    setMeterR((prev) => ({ ...prev, clip: false, peak: 0 }));
  };

  const scaleMarks = [-48, -24, -12, -6, 0, 3];

  if (orientation === "vertical") {
    return (
      <div
        className={cn("flex items-end gap-1.5 select-none font-mono text-[9px]", className)}
        title="Click to reset peak / clip latches"
        onClick={resetClip}
      >
        <div className="flex h-36 gap-1 bg-[var(--meter-bg)] p-1 rounded border border-[var(--border-subtle)]">
          {/* Left channel */}
          <div className="relative w-2.5 h-full rounded-sm overflow-hidden bg-black/40">
            <div
              className="absolute bottom-0 w-full rounded-sm bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ height: `${meterL.rms * 100}%` }}
            />
            {meterL.peak > 0 && (
              <div
                className="absolute w-full h-[2px] bg-white shadow-sm"
                style={{ bottom: `${meterL.peak * 100}%` }}
              />
            )}
          </div>

          {/* Right channel */}
          <div className="relative w-2.5 h-full rounded-sm overflow-hidden bg-black/40">
            <div
              className="absolute bottom-0 w-full rounded-sm bg-gradient-to-t from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ height: `${meterR.rms * 100}%` }}
            />
            {meterR.peak > 0 && (
              <div
                className="absolute w-full h-[2px] bg-white shadow-sm"
                style={{ bottom: `${meterR.peak * 100}%` }}
              />
            )}
          </div>
        </div>

        {/* Clip LEDs */}
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              "h-2 w-2 rounded-full border border-black/40 transition-colors",
              meterL.clip || meterR.clip ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : "bg-rose-950"
            )}
            title="Clip Overload"
          />
        </div>
      </div>
    );
  }

  // Horizontal layout (standard for DAW top bar)
  return (
    <div
      onClick={resetClip}
      className={cn(
        "flex flex-col gap-1 select-none font-mono text-[9px] cursor-pointer",
        className
      )}
      title="Stereo DIN PPM Audio Meter (Click to reset peak & clip indicators)"
    >
      {/* Stereo bars container */}
      <div className="flex flex-col gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--meter-bg)] p-1.5 shadow-inner">
        {/* Channel L */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 text-[8px] font-bold text-[var(--text-muted)]">L</span>
          <div className="relative h-2 w-32 sm:w-44 overflow-hidden rounded-sm bg-black/50">
            {/* RMS Fill */}
            <div
              className="h-full rounded-sm bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ width: `${meterL.rms * 100}%` }}
            />
            {/* Peak hold line */}
            {meterL.peak > 0 && (
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-sm"
                style={{ left: `${Math.min(99, meterL.peak * 100)}%` }}
              />
            )}
          </div>
          <span
            className={cn(
              "h-2 w-2 rounded-full border border-black/50 transition-colors",
              meterL.clip ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : "bg-rose-950"
            )}
            title="Clip Left"
          />
        </div>

        {/* Channel R */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 text-[8px] font-bold text-[var(--text-muted)]">R</span>
          <div className="relative h-2 w-32 sm:w-44 overflow-hidden rounded-sm bg-black/50">
            {/* RMS Fill */}
            <div
              className="h-full rounded-sm bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
              style={{ width: `${meterR.rms * 100}%` }}
            />
            {/* Peak hold line */}
            {meterR.peak > 0 && (
              <div
                className="absolute top-0 bottom-0 w-[2px] bg-white shadow-sm"
                style={{ left: `${Math.min(99, meterR.peak * 100)}%` }}
              />
            )}
          </div>
          <span
            className={cn(
              "h-2 w-2 rounded-full border border-black/50 transition-colors",
              meterR.clip ? "bg-rose-500 shadow-[0_0_8px_#f43f5e]" : "bg-rose-950"
            )}
            title="Clip Right"
          />
        </div>
      </div>

      {showLabels && (
        <div className="flex justify-between px-3 text-[8px] text-[var(--text-muted)]">
          {scaleMarks.map((m) => (
            <span key={m}>{m > 0 ? `+${m}` : m}</span>
          ))}
        </div>
      )}
    </div>
  );
}
