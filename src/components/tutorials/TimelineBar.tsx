// Interactive scrub bar with chapter markers and hover preview tooltip.
"use client";

import { useRef, useState } from "react";
import type { TutorialChapter } from "@/lib/tutorial-data";
import { formatTimestamp } from "@/lib/vtt-parser";

interface TimelineBarProps {
  currentTime: number;
  duration: number;
  chapters: TutorialChapter[];
  onSeek: (seconds: number) => void;
  bufferedPercent?: number;
}

export function TimelineBar({
  currentTime,
  duration,
  chapters,
  onSeek,
  bufferedPercent = 0,
}: TimelineBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number>(0);
  const [hoverChapter, setHoverChapter] = useState<TutorialChapter | null>(null);

  const currentPercent = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = x / rect.width;
    const time = pct * duration;

    setHoverX(x);
    setHoverTime(time);

    const chapter = chapters.find((c) => time >= c.startTime && time < c.endTime) ?? null;
    setHoverChapter(chapter);
  };

  const handlePointerLeave = () => {
    setHoverTime(null);
    setHoverChapter(null);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current || duration <= 0) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct * duration);
  };

  return (
    <div className="relative w-full select-none py-2" onPointerLeave={handlePointerLeave}>
      {/* Hover preview tooltip */}
      {hoverTime !== null && (
        <div
          className="pointer-events-none absolute bottom-8 z-30 -translate-x-1/2 rounded-md bg-[var(--bg-secondary)] px-2.5 py-1 text-xs shadow-lg border border-[var(--border-subtle)] whitespace-nowrap"
          style={{ left: `${hoverX}px` }}
        >
          <div className="font-semibold text-[var(--text-primary)]">
            {formatTimestamp(hoverTime)}
            {hoverChapter && <span className="ml-1.5 text-[var(--accent-primary)] font-medium">Ch.{hoverChapter.chapterNumber}</span>}
          </div>
          {hoverChapter && (
            <div className="max-w-[200px] truncate text-[10px] text-[var(--text-muted)]">
              {hoverChapter.title}
            </div>
          )}
        </div>
      )}

      {/* Track bar container */}
      <div
        ref={barRef}
        role="slider"
        aria-label="Timeline seek bar"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={currentTime}
        aria-valuetext={formatTimestamp(currentTime)}
        tabIndex={0}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            onSeek(Math.max(0, currentTime - 5));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            onSeek(Math.min(duration, currentTime + 5));
          } else if (e.key === "Home") {
            e.preventDefault();
            onSeek(0);
          } else if (e.key === "End") {
            e.preventDefault();
            onSeek(duration);
          }
        }}
        className="relative h-2.5 w-full cursor-pointer rounded-full bg-white/10 transition-all hover:h-3.5 focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
      >
        {/* Buffered range */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white/20 transition-[width] duration-200"
          style={{ width: `${bufferedPercent}%` }}
        />

        {/* Playback progress */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)]"
          style={{ width: `${currentPercent}%` }}
        />

        {/* Chapter marker ticks */}
        {chapters.map((c) => {
          const markerPct = (c.startTime / duration) * 100;
          return (
            <div
              key={c.id}
              title={`Ch.${c.chapterNumber}: ${c.title}`}
              className="group/marker absolute top-0 z-10 -ml-0.5 h-full w-1 rounded-sm bg-white/50 transition-colors hover:bg-[var(--accent-primary)]"
              style={{ left: `${markerPct}%` }}
            />
          );
        })}

        {/* Playhead thumb */}
        <div
          className="absolute top-1/2 -mt-2 -ml-2 h-4 w-4 rounded-full bg-white shadow-md ring-2 ring-[var(--accent-primary)] transition-transform group-hover/track:scale-125"
          style={{ left: `${currentPercent}%` }}
        />
      </div>
    </div>
  );
}
