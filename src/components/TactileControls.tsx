// SonicBlueprint Tactile Controls
// Hardware-inspired TactileSlider and TactileKnob with Shift-drag fine adjustment,
// double-click default reset, floating numeric tooltips, and spring kinematics.
"use client";

import { useState, useRef, useEffect } from "react";
import { applyFineDragDelta } from "@/lib/sequencer-kinetics";
import { cn } from "@/lib/cn";

export interface TactileSliderProps {
  value: number;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  defaultValue?: number | undefined;
  onChange: (value: number) => void;
  label?: string | undefined;
  unit?: string | undefined;
  formatValue?: ((value: number) => string) | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

export function TactileSlider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue = 0.8,
  onChange,
  label,
  unit = "",
  formatValue,
  className,
  disabled = false,
}: TactileSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isFine, setIsFine] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const lastXRef = useRef<number>(0);
  const currentRawRef = useRef<number>(value);

  // Synchronize external value changes when not actively dragging
  useEffect(() => {
    if (!isDragging) {
      currentRawRef.current = value;
    }
  }, [value, isDragging]);

  const range = max - min;
  const progressRatio = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;

  const displayVal = formatValue
    ? formatValue(value)
    : `${unit === "%" ? Math.round(value * 100) : value.toFixed(step < 0.1 ? 2 : 1)}${unit}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    setIsFine(e.shiftKey);
    lastXRef.current = e.clientX;

    // Direct jump on initial click
    if (trackRef.current) {
      const rect = trackRef.current.getBoundingClientRect();
      const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const rawVal = min + clickRatio * range;
      const stepped = Math.round(rawVal / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      currentRawRef.current = clamped;
      onChange(Number(clamped.toFixed(4)));
    } else {
      currentRawRef.current = value;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled || !trackRef.current) return;
    const shiftHeld = e.shiftKey;
    setIsFine(shiftHeld);

    const deltaX = e.clientX - lastXRef.current;
    lastXRef.current = e.clientX;

    if (deltaX !== 0) {
      const trackWidth = trackRef.current.getBoundingClientRect().width;
      const deltaVal = applyFineDragDelta(deltaX, shiftHeld, range, trackWidth, 0.2);
      const nextRaw = Math.max(min, Math.min(max, currentRawRef.current + deltaVal));
      currentRawRef.current = nextRaw;

      const stepped = Math.round(nextRaw / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      onChange(Number(clamped.toFixed(4)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    if (defaultValue !== undefined) {
      onChange(defaultValue);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(15);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const increment = (e.shiftKey ? step * 0.2 : step) || 0.01;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(max, Number((value + increment).toFixed(4))));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(min, Number((value - increment).toFixed(4))));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  };

  return (
    <div className={cn("relative flex flex-col gap-1 select-none", className)}>
      {label && (
        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-secondary)]">
          <span>{label}</span>
          <span className="font-mono text-[var(--accent-primary)] font-bold">
            {displayVal}
          </span>
        </div>
      )}

      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayVal}
        aria-label={label ?? "Tactile Fader"}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "relative flex h-8 w-full cursor-pointer items-center touch-none",
          disabled && "cursor-not-allowed opacity-40"
        )}
      >
        {/* Track background */}
        <div className="relative h-2 w-full overflow-hidden rounded-full border border-[var(--border-subtle)] bg-[var(--bg-input)]">
          {/* Active fill */}
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-all"
            style={{ width: `${progressRatio * 100}%` }}
          />
        </div>

        {/* Thumb */}
        <div
          className={cn(
            "tactile-pad absolute top-1/2 -ml-2.5 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-[var(--accent-primary)] bg-[var(--text-primary)] shadow-md transition-transform",
            isDragging && "scale-125 shadow-[var(--accent-glow)] ring-2 ring-[var(--accent-primary)]/40"
          )}
          style={{ left: `${progressRatio * 100}%` }}
        />

        {/* Floating Value Tooltip during drag */}
        {isDragging && (
          <div
            className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded bg-[var(--bg-elevated)] px-2 py-0.5 font-mono text-[11px] font-bold text-[var(--text-primary)] shadow-lg ring-1 ring-[var(--border-focus)] transition-all"
            style={{ left: `${progressRatio * 100}%` }}
          >
            {displayVal} {isFine && <span className="text-[9px] text-[var(--accent-primary)]">FINE</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export interface TactileKnobProps {
  value: number;
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  defaultValue?: number | undefined;
  onChange: (value: number) => void;
  size?: number | undefined;
  label?: string | undefined;
  unit?: string | undefined;
  formatValue?: ((value: number) => string) | undefined;
  className?: string | undefined;
  disabled?: boolean | undefined;
}

export function TactileKnob({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  defaultValue = 0.5,
  onChange,
  size = 54,
  label,
  unit = "",
  formatValue,
  className,
  disabled = false,
}: TactileKnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastYRef = useRef<number>(0);
  const currentRawRef = useRef<number>(value);

  useEffect(() => {
    if (!isDragging) {
      currentRawRef.current = value;
    }
  }, [value, isDragging]);

  const range = max - min;
  const progressRatio = range > 0 ? Math.max(0, Math.min(1, (value - min) / range)) : 0;

  // Knob rotation: 270 degree sweep from 135 deg to 405 deg
  const startAngle = 135;
  const endAngle = 405;
  const currentAngle = startAngle + progressRatio * (endAngle - startAngle);

  const displayVal = formatValue
    ? formatValue(value)
    : `${unit === "%" ? Math.round(value * 100) : value.toFixed(step < 0.1 ? 2 : 1)}${unit}`;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    lastYRef.current = e.clientY;
    currentRawRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || disabled) return;
    const shiftHeld = e.shiftKey;
    const deltaY = lastYRef.current - e.clientY; // Drag up increases
    lastYRef.current = e.clientY;

    if (deltaY !== 0) {
      const deltaVal = applyFineDragDelta(deltaY, shiftHeld, range, 120, 0.2);
      const nextRaw = Math.max(min, Math.min(max, currentRawRef.current + deltaVal));
      currentRawRef.current = nextRaw;

      const stepped = Math.round(nextRaw / step) * step;
      const clamped = Math.max(min, Math.min(max, stepped));
      onChange(Number(clamped.toFixed(4)));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDragging(false);
  };

  const handleDoubleClick = () => {
    if (disabled) return;
    if (defaultValue !== undefined) {
      onChange(defaultValue);
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(15);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const increment = (e.shiftKey ? step * 0.2 : step) || 0.01;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(max, Number((value + increment).toFixed(4))));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(min, Number((value - increment).toFixed(4))));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(min);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(max);
    }
  };

  // SVG arc calculations
  const r = (size - 8) / 2;
  const cx = size / 2;
  const cy = size / 2;

  const polarToCartesian = (angleDeg: number) => {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  const startPt = polarToCartesian(startAngle);
  const endPt = polarToCartesian(endAngle);
  const curPt = polarToCartesian(currentAngle);

  const bgArc = `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 1 1 ${endPt.x} ${endPt.y}`;
  const largeArcFlag = currentAngle - startAngle <= 180 ? 0 : 1;
  const activeArc = `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${curPt.x} ${curPt.y}`;

  return (
    <div className={cn("inline-flex flex-col items-center select-none", className)}>
      <div
        role="slider"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={displayVal}
        aria-label={label ?? "Tactile Rotary Dial"}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className={cn(
          "relative flex cursor-ns-resize items-center justify-center touch-none",
          disabled && "cursor-not-allowed opacity-40"
        )}
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="overflow-visible">
          {/* Background arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="var(--bg-input)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          {/* Active progress arc */}
          <path
            d={activeArc}
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth={4}
            strokeLinecap="round"
            style={{ filter: "drop-shadow(0 0 6px var(--accent-primary))" }}
          />
          {/* Knob face */}
          <circle
            cx={cx}
            cy={cy}
            r={r - 6}
            fill="var(--bg-surface)"
            stroke="var(--border-subtle)"
            strokeWidth={1.5}
            className={cn("transition-transform", isDragging && "brightness-125")}
          />
          {/* Pointer dot */}
          <circle
            cx={cx + (r - 10) * Math.cos(((currentAngle - 90) * Math.PI) / 180)}
            cy={cy + (r - 10) * Math.sin(((currentAngle - 90) * Math.PI) / 180)}
            r={2.5}
            fill="var(--accent-primary)"
            style={{ filter: "drop-shadow(0 0 4px var(--accent-primary))" }}
          />
        </svg>

        {isDragging && (
          <div className="pointer-events-none absolute -top-7 rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--text-primary)] shadow-md ring-1 ring-[var(--border-focus)]">
            {displayVal}
          </div>
        )}
      </div>

      {label && (
        <span className="mt-1 text-center font-mono text-[10px] font-semibold text-[var(--text-secondary)]">
          {label}
        </span>
      )}
    </div>
  );
}
