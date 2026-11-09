// Custom HTML5 video player with chapter markers, speed control, PiP, and "Try in Studio" overlay.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  PictureInPicture2,
  Subtitles,
  Sparkles,
  FastForward,
} from "lucide-react";
import type { TutorialChapter, TutorialVideoMeta } from "@/lib/tutorial-data";
import type { WebVttCue } from "@/lib/vtt-parser";
import { formatTimestamp, findActiveCue } from "@/lib/vtt-parser";
import { TimelineBar } from "./TimelineBar";
import { CaptionDisplay } from "./CaptionDisplay";
import { cn } from "@/lib/cn";

interface TutorialPlayerProps {
  meta: TutorialVideoMeta;
  cues: WebVttCue[];
  currentTime: number;
  onTimeUpdate: (seconds: number) => void;
  onTryInStudio: (presetId: string) => void;
  hydratingPresetId?: string | null;
}

const SPEEDS = [0.75, 1, 1.25, 1.5];

export function TutorialPlayer({
  meta,
  cues,
  currentTime,
  onTimeUpdate,
  onTryInStudio,
  hydratingPresetId = null,
}: TutorialPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(meta.duration || 420);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(() => {
    if (typeof window === "undefined") return 1;
    try {
      const savedSpeed = localStorage.getItem("sb:tutorial-speed");
      if (savedSpeed) {
        const val = parseFloat(savedSpeed);
        if (SPEEDS.includes(val)) return val;
      }
    } catch {
      // ignore
    }
    return 1;
  });
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [bannerDismissedForChapter, setBannerDismissedForChapter] = useState<string | null>(null);

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    try {
      localStorage.setItem("sb:tutorial-speed", String(speed));
    } catch {
      // ignore
    }
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(duration, seconds));
    videoRef.current.currentTime = clamped;
    onTimeUpdate(clamped);
  }, [duration, onTimeUpdate]);

  const toggleMute = useCallback(() => {
    if (!videoRef.current) return;
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, []);

  const handleVolumeChange = (v: number) => {
    setVolume(v);
    setIsMuted(v === 0);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
  };

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // ignore
    }
  }, []);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "KeyK") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "KeyJ") {
        e.preventDefault();
        seek(currentTime - 5);
      } else if (e.code === "KeyL") {
        e.preventDefault();
        seek(currentTime + 10);
      } else if (e.code === "KeyM") {
        e.preventDefault();
        toggleMute();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.code === "KeyC") {
        e.preventDefault();
        setCaptionsEnabled((prev) => !prev);
      } else if (e.code === "KeyP") {
        e.preventDefault();
        togglePiP();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [togglePlay, seek, currentTime, toggleMute, toggleFullscreen, togglePiP]);

  // Video event handlers
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const time = videoRef.current.currentTime;
    onTimeUpdate(time);

    // Compute buffer
    if (videoRef.current.buffered.length > 0 && duration > 0) {
      const bufEnd = videoRef.current.buffered.end(videoRef.current.buffered.length - 1);
      setBufferedPercent((bufEnd / duration) * 100);
    }
  };

  // Active cue for captions
  const activeCue = findActiveCue(cues, currentTime);

  // Active chapter
  const activeChapter: TutorialChapter | null =
    meta.chapters.find((c) => currentTime >= c.startTime && currentTime < c.endTime) ?? null;

  const showChapterBanner =
    activeChapter?.presetId && bannerDismissedForChapter !== activeChapter.id;

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-black shadow-2xl",
        meta.aspectRatio === "9:16" ? "max-w-[420px] mx-auto aspect-[9/16]" : "w-full aspect-video"
      )}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={meta.src}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration || meta.duration);
            videoRef.current.playbackRate = playbackSpeed;
          }
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        className="h-full w-full object-contain cursor-pointer"
      >
        {meta.fallbackSrc && <source src={meta.fallbackSrc} type="video/mp4" />}
        Your browser does not support HTML5 video.
      </video>

      {/* Floating Center Play/Pause Overlay Button */}
      {!isPlaying && (
        <button
          type="button"
          aria-label="Play video"
          onClick={togglePlay}
          className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-primary)]/90 text-white shadow-xl backdrop-blur-sm transition-transform hover:scale-110 active:scale-95"
        >
          <Play className="ml-1 h-8 w-8 fill-current" />
        </button>
      )}

      {/* Synchronized Closed Captions Display */}
      <CaptionDisplay activeCue={activeCue} enabled={captionsEnabled} />

      {/* "Try in Studio" Notification Pill for Chapters with Presets */}
      {showChapterBanner && activeChapter?.presetId && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2 rounded-xl border border-[var(--accent-primary)]/40 bg-[var(--bg-secondary)]/90 px-3.5 py-2 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300">
          <Sparkles className="h-4 w-4 text-[var(--accent-primary)]" />
          <div className="text-xs">
            <span className="font-semibold text-[var(--text-primary)]">
              {activeChapter.presetLabel ?? "Lesson Preset Available"}
            </span>
          </div>
          <button
            type="button"
            disabled={hydratingPresetId === activeChapter.presetId}
            onClick={() => {
              if (activeChapter.presetId) onTryInStudio(activeChapter.presetId);
            }}
            className="ml-2 rounded-md bg-[var(--accent-primary)] px-2.5 py-1 text-xs font-bold text-[var(--text-on-accent)] shadow hover:bg-[var(--accent-hover)] transition-colors"
          >
            {hydratingPresetId === activeChapter.presetId ? "Opening…" : "Try in Studio →"}
          </button>
          <button
            type="button"
            onClick={() => setBannerDismissedForChapter(activeChapter.id)}
            aria-label="Dismiss banner"
            className="text-[var(--text-muted)] hover:text-white text-xs pl-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bottom Controls Bar Overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 transition-opacity">
        {/* Timeline seek scrub bar */}
        <TimelineBar
          currentTime={currentTime}
          duration={duration}
          chapters={meta.chapters}
          onSeek={seek}
          bufferedPercent={bufferedPercent}
        />

        {/* Action Controls Row */}
        <div className="mt-1 flex items-center justify-between gap-3 text-xs text-white">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seek(activeChapter?.startTime ?? 0)}
              title="Restart chapter"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 text-white/80"
            >
              <RotateCcw className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => seek(currentTime + 10)}
              title="Forward 10s"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 text-white/80"
            >
              <FastForward className="h-4 w-4" />
            </button>

            {/* Volume control */}
            <div className="flex items-center gap-1.5 ml-1">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10"
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 text-red-400" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume slider"
                className="h-1.5 w-16 cursor-pointer accent-[var(--accent-primary)] hidden sm:inline-block"
              />
            </div>

            {/* Timestamp text */}
            <div className="font-mono text-[11px] text-white/80 ml-2">
              {formatTimestamp(currentTime)} <span className="text-white/40">/</span> {formatTimestamp(duration)}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Speed selection pills */}
            <div className="hidden sm:flex items-center rounded-lg bg-white/10 p-0.5" role="radiogroup" aria-label="Playback speed">
              {SPEEDS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSpeedChange(s)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors",
                    playbackSpeed === s
                      ? "bg-[var(--accent-primary)] text-[var(--text-on-accent)]"
                      : "text-white/70 hover:text-white"
                  )}
                >
                  {s}x
                </button>
              ))}
            </div>

            {/* Closed captions toggle */}
            <button
              type="button"
              onClick={() => setCaptionsEnabled((p) => !p)}
              aria-label="Toggle closed captions"
              title="Closed Captions (C)"
              className={cn(
                "grid h-8 w-8 place-items-center rounded-lg transition-colors",
                captionsEnabled ? "bg-white/20 text-[var(--accent-primary)]" : "hover:bg-white/10 text-white/70"
              )}
            >
              <Subtitles className="h-4 w-4" />
            </button>

            {/* Picture-in-Picture */}
            <button
              type="button"
              onClick={togglePiP}
              aria-label="Picture-in-Picture"
              title="Picture-in-Picture (P)"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 text-white/80"
            >
              <PictureInPicture2 className="h-4 w-4" />
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              title="Fullscreen (F)"
              className="grid h-8 w-8 place-items-center rounded-lg hover:bg-white/10 text-white/80"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
