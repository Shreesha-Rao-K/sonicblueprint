// Subtitle overlay rendering WebVTT cues over the video player.
"use client";

import type { WebVttCue } from "@/lib/vtt-parser";

interface CaptionDisplayProps {
  activeCue: WebVttCue | null;
  enabled: boolean;
}

export function CaptionDisplay({ activeCue, enabled }: CaptionDisplayProps) {
  if (!enabled || !activeCue || !activeCue.text.trim()) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute bottom-14 left-4 right-4 z-20 flex justify-center text-center"
    >
      <div className="inline-block max-w-[90%] rounded-lg bg-black/85 px-4 py-2 text-sm sm:text-base font-medium text-white shadow-lg backdrop-blur-sm leading-relaxed transition-opacity">
        {activeCue.text}
      </div>
    </div>
  );
}
