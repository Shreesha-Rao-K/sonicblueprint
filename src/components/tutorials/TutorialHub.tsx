// Top-level Tutorial Hub orchestrating video playback, chapter navigation, transcript search, and preset hydration.
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Monitor,
  Smartphone,
  GraduationCap,
  Sparkles,
  BookOpen,
  Volume2,
  Share2,
} from "lucide-react";
import {
  TUTORIAL_VIDEOS,
  PC_TUTORIAL_VTT,
  PHONE_TUTORIAL_VTT,
  type TutorialChapter,
} from "@/lib/tutorial-data";
import { parseWebVtt } from "@/lib/vtt-parser";
import { TUTORIAL_PRESETS, hydrateTutorialPreset } from "@/lib/tutorial-presets";
import { TutorialPlayer } from "./TutorialPlayer";
import { ChapterList } from "./ChapterList";
import { TranscriptView } from "./TranscriptView";
import { cn } from "@/lib/cn";

export function TutorialHub() {
  const router = useRouter();
  const [activePlatform, setActivePlatform] = useState<"pc" | "phone">("pc");
  const [currentTime, setCurrentTime] = useState(0);
  const [activeTab, setActiveTab] = useState<"chapters" | "transcript">("chapters");
  const [hydratingPresetId, setHydratingPresetId] = useState<string | null>(null);

  const videoMeta = TUTORIAL_VIDEOS[activePlatform];

  // Parse cues for active platform
  const cues = useMemo(() => {
    return parseWebVtt(activePlatform === "pc" ? PC_TUTORIAL_VTT : PHONE_TUTORIAL_VTT);
  }, [activePlatform]);

  const handleTryInStudio = async (presetId: string) => {
    try {
      setHydratingPresetId(presetId);
      await hydrateTutorialPreset(presetId, router);
    } catch (err) {
      console.error("Failed to hydrate tutorial preset:", err);
      setHydratingPresetId(null);
    }
  };

  const handleSelectChapter = (chapter: TutorialChapter) => {
    setCurrentTime(chapter.startTime);
    // Notify any video ref if needed, or rely on player sync
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 p-4 md:p-8">
      {/* Hero Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-subtle)] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-primary)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-primary)] mb-2">
            <GraduationCap className="h-4 w-4" /> Interactive Video Masterclass
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-3xl">
            SonicBlueprint Tutorial Hub
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)] max-w-2xl">
            Master the in-browser DAW with synchronized chapter scrubbing, interactive transcript keyword search, and one-click &quot;Try in Studio&quot; preset hydration.
          </p>
        </div>

        {/* Platform Toggle Tabs */}
        <div className="flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              setActivePlatform("pc");
              setCurrentTime(0);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              activePlatform === "pc"
                ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Monitor className="h-4 w-4" /> Desktop Studio (16:9)
          </button>
          <button
            type="button"
            onClick={() => {
              setActivePlatform("phone");
              setCurrentTime(0);
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              activePlatform === "phone"
                ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            <Smartphone className="h-4 w-4" /> Mobile Touch (9:16)
          </button>
        </div>
      </div>

      {/* Main Video & Navigation Split Grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_440px]">
        {/* Left: Custom Video Player */}
        <div className="space-y-4">
          <TutorialPlayer
            meta={videoMeta}
            cues={cues}
            currentTime={currentTime}
            onTimeUpdate={setCurrentTime}
            onTryInStudio={handleTryInStudio}
            hydratingPresetId={hydratingPresetId}
          />

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
            <h2 className="text-base font-bold text-[var(--text-primary)]">{videoMeta.title}</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
              {videoMeta.description}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--text-muted)] border-t border-[var(--border-subtle)]/60 pt-3">
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> 7 Chapters (420.0s)
              </span>
              <span className="flex items-center gap-1.5">
                <Volume2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> -14.1 LUFS Mastered Audio
              </span>
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> 5 Interactive DAW Presets
              </span>
              <span className="flex items-center gap-1.5">
                <Share2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" /> Zero Backend URL Sharing
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sidebar Tabs (Chapters vs Interactive Transcript) */}
        <div className="flex h-[600px] flex-col space-y-3">
          {/* Tab Selector Buttons */}
          <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-1">
            <button
              type="button"
              onClick={() => setActiveTab("chapters")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-bold transition-colors",
                activeTab === "chapters"
                  ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              Chapters ({videoMeta.chapters.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("transcript")}
              className={cn(
                "flex-1 rounded-md py-1.5 text-xs font-bold transition-colors",
                activeTab === "transcript"
                  ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              Transcript ({cues.length} cues)
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === "chapters" ? (
              <ChapterList
                chapters={videoMeta.chapters}
                currentTime={currentTime}
                onSelectChapter={handleSelectChapter}
                onTryInStudio={handleTryInStudio}
                hydratingPresetId={hydratingPresetId}
              />
            ) : (
              <TranscriptView
                cues={cues}
                currentTime={currentTime}
                onSeek={setCurrentTime}
              />
            )}
          </div>
        </div>
      </div>

      {/* "Try in Studio" Presets Catalog Showcase */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[var(--accent-primary)]" />
              &quot;Try in Studio&quot; Interactive Project Presets
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Jump straight into a live session loaded with the exact musical patterns, voicings, and effects from this tutorial.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.values(TUTORIAL_PRESETS).map((p) => {
            const isOpening = hydratingPresetId === p.id;
            const bpm = p.projectSeed.config?.bpm ?? 100;
            const key = p.projectSeed.config?.keyTonic ?? "C";
            const scale = p.projectSeed.config?.scale ?? "minor";

            return (
              <div
                key={p.id}
                className="group flex flex-col justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 transition-all hover:border-[var(--accent-primary)]/50 hover:shadow-lg"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="font-mono text-[10px] font-semibold text-[var(--accent-primary)] uppercase tracking-wider">
                      {key.replace("b", "♭")} {scale} • {bpm} BPM
                    </span>
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
                      {p.targetSelector}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                    {p.name.replace("Tutorial: ", "")}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--text-secondary)] leading-relaxed">
                    {p.description}
                  </p>
                </div>

                <div className="mt-4 border-t border-[var(--border-subtle)]/60 pt-3 flex items-center justify-between">
                  <span className="text-[11px] text-[var(--text-muted)]">Target: {p.targetSelector.replace("#panel-", "")}</span>
                  <button
                    type="button"
                    disabled={isOpening}
                    onClick={() => handleTryInStudio(p.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-bold text-[var(--text-on-accent)] shadow hover:bg-[var(--accent-hover)] transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isOpening ? "Hydrating Studio…" : "Open in Studio →"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
