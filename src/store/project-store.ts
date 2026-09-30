// Editor state — separated from audio/playback state for render performance.
"use client";

import { create } from "zustand";
import type { SonicProject } from "@/lib/project-schema";
import { createProject, normalizeProject, touchProject } from "@/lib/project-schema";
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
}));

// ── Playback state (tiny, updated at ~4Hz max from engine) ──
interface TransportState {
  playing: boolean;
  positionSec: number;
  durationSec: number;
  chordIndex: number;
  sectionIndex: number;
  loop: boolean;
  volume: number;
  muted: boolean;
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
  set: (s) => set(s),
}));
