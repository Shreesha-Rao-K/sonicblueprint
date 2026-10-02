// Editor state — separated from audio/playback state for render performance.
"use client";

import { create } from "zustand";
import type { SonicProject } from "@/lib/project-schema";
import {
  createProject,
  createVersion as appendVersion,
  deleteVersion as dropVersion,
  normalizeProject,
  restoreVersion as applyVersion,
  touchProject,
} from "@/lib/project-schema";
import { saveProject as persist } from "@/lib/storage";

interface ProjectState {
  project: SonicProject | null;
  dirty: boolean;
  saving: boolean;
  lastSavedAt: string | null;
  past: SonicProject[];
  future: SonicProject[];
  load: (p: SonicProject) => void;
  createNew: (name?: string, seed?: Partial<SonicProject>) => void;
  update: (fn: (p: SonicProject) => SonicProject) => void;
  rename: (name: string) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  saveVersion: (label?: string) => Promise<void>;
  restoreVersion: (versionId: string) => boolean;
  deleteVersion: (versionId: string) => Promise<void>;
}

const HISTORY_LIMIT = 60;

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  dirty: false,
  saving: false,
  lastSavedAt: null,
  past: [],
  future: [],
  load: (p) => set({ project: normalizeProject(p), dirty: false, past: [], future: [] }),
  createNew: (name, seed) => set({
    project: createProject(name ?? "Untitled Blueprint", seed),
    dirty: true,
    past: [],
    future: [],
  }),
  update: (fn) =>
    set((s) => {
      if (!s.project) return s;
      const next = fn(s.project);
      if (next === s.project) return s;
      const past = [...s.past, structuredClone(s.project)];
      while (past.length > HISTORY_LIMIT) past.shift();
      return { project: next, dirty: true, past, future: [] };
    }),
  rename: (name) =>
    set((s) => {
      if (!s.project) return s;
      return { project: { ...s.project, meta: { ...s.project.meta, name } }, dirty: true };
    }),
  undo: () =>
    set((s) => {
      if (!s.project || s.past.length === 0) return s;
      const previous = s.past[s.past.length - 1];
      return {
        project: previous,
        dirty: true,
        past: s.past.slice(0, -1),
        future: [structuredClone(s.project), ...s.future].slice(0, HISTORY_LIMIT),
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.project || s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return {
        project: next,
        dirty: true,
        past: [...s.past, structuredClone(s.project)].slice(-HISTORY_LIMIT),
        future: rest,
      };
    }),
  save: async () => {
    const { project } = get();
    if (!project) return;
    set({ saving: true });
    const touched = touchProject(project);
    await persist(touched);
    set({ project: touched, dirty: false, saving: false, lastSavedAt: touched.meta.updatedAt });
  },
  // Deliberate snapshots ("Save Version"): history metadata only — the musical
  // state is untouched and undo history is left alone. Persisted immediately
  // so a version survives even if the tab closes before the next manual save.
  saveVersion: async (label) => {
    const { project, save } = get();
    if (!project) return;
    set({ project: appendVersion(project, label), dirty: true });
    await save();
  },
  // Restore replaces the working state but stays undoable (Ctrl+Z brings back
  // the pre-restore state) and unsaved until the next manual save.
  restoreVersion: (versionId) => {
    const { project } = get();
    if (!project) return false;
    const next = applyVersion(project, versionId);
    if (!next) return false;
    set((s) => {
      if (!s.project) return s;
      const past = [...s.past, structuredClone(s.project)];
      while (past.length > HISTORY_LIMIT) past.shift();
      return { project: next, dirty: true, past, future: [] };
    });
    return true;
  },
  deleteVersion: async (versionId) => {
    const { project, save } = get();
    if (!project) return;
    const next = dropVersion(project, versionId);
    if (next === project) return;
    set({ project: next, dirty: true });
    await save();
  },
}));

// ── Playback state (tiny, updated at ~4Hz max from engine) ──
// audio tracks the user-facing sound lifecycle: idle → starting → playing,
// with error when startup fails (message in audioError, retry re-enters
// starting). Normal playback shows no extra chrome.
export type AudioUiState = "idle" | "starting" | "playing" | "error";

interface TransportState {
  playing: boolean;
  positionSec: number;
  durationSec: number;
  chordIndex: number;
  sectionIndex: number;
  loop: boolean;
  volume: number;
  muted: boolean;
  audio: AudioUiState;
  audioError: string | null;
  /** Nonfatal notice, e.g. sampled sounds fell back to synthesis. */
  sampleNote: string | null;
  set: (s: Partial<TransportState>) => void;
}

export const useTransportStore = create<TransportState>((set) => ({
  playing: false,
  positionSec: 0,
  durationSec: 0,
  chordIndex: 0,
  sectionIndex: 0,
  loop: false,
  volume: 0.8,
  muted: false,
  audio: "idle",
  audioError: null,
  sampleNote: null,
  set: (s) => set(s),
}));
