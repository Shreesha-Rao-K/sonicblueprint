"use client";

import { create } from "zustand";
import {
  type DawTheme,
  DEFAULT_THEME,
  isValidTheme,
  applyTheme,
  getStoredTheme,
} from "@/styles/themes";

export interface ThemeStoreState {
  theme: DawTheme;
  setTheme: (theme: DawTheme) => void;
  initialize: () => void;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: DEFAULT_THEME,
  setTheme: (theme: DawTheme) => {
    if (!isValidTheme(theme)) return;
    applyTheme(theme);
    set({ theme });
  },
  initialize: () => {
    const stored = getStoredTheme();
    applyTheme(stored);
    if (get().theme !== stored) {
      set({ theme: stored });
    }
  },
}));
