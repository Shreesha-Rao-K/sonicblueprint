// Searchable interactive transcript view with one-click timestamp seeking.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Clock } from "lucide-react";
import type { WebVttCue } from "@/lib/vtt-parser";
import { formatTimestamp } from "@/lib/vtt-parser";
import { cn } from "@/lib/cn";

interface TranscriptViewProps {
  cues: WebVttCue[];
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export function TranscriptView({ cues, currentTime, onSeek }: TranscriptViewProps) {
  const [search, setSearch] = useState("");
  const activeItemRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredCues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cues;
    return cues.filter((c) => c.text.toLowerCase().includes(q));
  }, [cues, search]);

  // Find active cue index
  const activeCue = useMemo(() => {
    return cues.find((c) => currentTime >= c.startTime && currentTime < c.endTime) ?? null;
  }, [cues, currentTime]);

  // Auto-scroll to active cue if not actively searching
  useEffect(() => {
    if (!search && activeItemRef.current && containerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeCue, search]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Interactive Transcript</h3>
        <span className="text-xs text-[var(--text-muted)]">
          {filteredCues.length} {filteredCues.length === 1 ? "line" : "lines"}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search transcript (e.g., voicing, arp, reverb)..."
          className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-void)] py-1.5 pl-9 pr-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
        />
      </div>

      {/* Cue List */}
      <div
        ref={containerRef}
        className="flex-1 space-y-1.5 overflow-y-auto pr-1 text-xs"
        tabIndex={0}
        aria-label="Transcript lines"
      >
        {filteredCues.length === 0 ? (
          <div className="py-8 text-center text-[var(--text-muted)]">No matching dialogue found.</div>
        ) : (
          filteredCues.map((c) => {
            const isActive = activeCue?.id === c.id;
            return (
              <div
                key={c.id}
                ref={isActive ? activeItemRef : undefined}
                onClick={() => onSeek(c.startTime)}
                className={cn(
                  "group flex cursor-pointer items-start gap-2.5 rounded-lg p-2 transition-colors",
                  isActive
                    ? "bg-[var(--accent-primary)]/15 border-l-2 border-[var(--accent-primary)] text-[var(--text-primary)]"
                    : "hover:bg-white/5 text-[var(--text-secondary)]"
                )}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSeek(c.startTime);
                  }}
                  className="flex shrink-0 items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-muted)] hover:bg-[var(--accent-primary)] hover:text-white"
                  title={`Jump to ${formatTimestamp(c.startTime)}`}
                >
                  <Clock className="h-3 w-3" />
                  {formatTimestamp(c.startTime)}
                </button>
                <p className="flex-1 leading-relaxed">{c.text}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
