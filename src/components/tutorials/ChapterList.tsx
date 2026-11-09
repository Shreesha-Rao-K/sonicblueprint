// Synchronized chapter list with active progress and "Try in Studio" action triggers.
"use client";

import { useEffect, useRef } from "react";
import { Sparkles, Play, CheckCircle2 } from "lucide-react";
import type { TutorialChapter } from "@/lib/tutorial-data";
import { formatTimestamp } from "@/lib/vtt-parser";
import { cn } from "@/lib/cn";

interface ChapterListProps {
  chapters: TutorialChapter[];
  currentTime: number;
  onSelectChapter: (chapter: TutorialChapter) => void;
  onTryInStudio: (presetId: string) => void;
  hydratingPresetId?: string | null;
}

export function ChapterList({
  chapters,
  currentTime,
  onSelectChapter,
  onTryInStudio,
  hydratingPresetId = null,
}: ChapterListProps) {
  const activeChapterRef = useRef<HTMLDivElement>(null);

  // Active chapter
  const activeChapter = chapters.find((c) => currentTime >= c.startTime && currentTime < c.endTime) ?? null;

  useEffect(() => {
    if (activeChapterRef.current) {
      activeChapterRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeChapter?.id]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Lesson Chapters</h3>
        <span className="text-xs text-[var(--text-muted)]">
          {chapters.length} chapters • 7:00 total
        </span>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1" tabIndex={0} aria-label="Course chapters">
        {chapters.map((ch) => {
          const isActive = activeChapter?.id === ch.id;
          const isCompleted = currentTime >= ch.endTime;
          const chapterProgress = isActive
            ? Math.min(100, Math.max(0, ((currentTime - ch.startTime) / (ch.endTime - ch.startTime)) * 100))
            : isCompleted
            ? 100
            : 0;

          return (
            <div
              key={ch.id}
              ref={isActive ? activeChapterRef : undefined}
              onClick={() => onSelectChapter(ch)}
              className={cn(
                "group relative cursor-pointer rounded-lg border p-3 transition-all",
                isActive
                  ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 shadow-sm"
                  : "border-[var(--border-subtle)] bg-[var(--bg-void)]/60 hover:border-white/20 hover:bg-[var(--bg-void)]"
              )}
            >
              {/* Active progress bar top highlight */}
              {isActive && (
                <div
                  className="absolute left-0 top-0 h-0.5 bg-[var(--accent-primary)] transition-[width] duration-300"
                  style={{ width: `${chapterProgress}%` }}
                />
              )}

              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold",
                      isActive
                        ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)]"
                        : isCompleted
                        ? "bg-white/10 text-emerald-400"
                        : "bg-white/5 text-[var(--text-muted)]"
                    )}
                  >
                    {isCompleted ? <CheckCircle2 className="h-3.5 w-3.5" /> : ch.chapterNumber}
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                      {ch.title}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">{ch.subtitle}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-[var(--text-muted)]">
                  <Play className="h-2.5 w-2.5 opacity-60" />
                  {formatTimestamp(ch.startTime)} – {formatTimestamp(ch.endTime)}
                </div>
              </div>

              {/* Key Takeaway */}
              <div className="mt-2 text-[11px] text-[var(--text-secondary)] leading-relaxed">
                {ch.keyTakeaway}
              </div>

              {/* Try in Studio Action Button */}
              {ch.presetId && (
                <div className="mt-2.5 flex items-center justify-between border-t border-[var(--border-subtle)]/60 pt-2">
                  <span className="text-[10px] text-[var(--text-muted)] font-medium truncate max-w-[170px]">
                    Preset: {ch.presetLabel ?? ch.presetId}
                  </span>
                  <button
                    type="button"
                    disabled={hydratingPresetId === ch.presetId}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (ch.presetId) onTryInStudio(ch.presetId);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[var(--accent-primary)]/20 px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)] hover:text-white transition-colors"
                  >
                    <Sparkles className="h-3 w-3" />
                    {hydratingPresetId === ch.presetId ? "Opening Studio…" : "Try in Studio →"}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
