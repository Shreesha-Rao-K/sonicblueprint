// Keyboard shortcuts cheat sheet modal with instant search and comprehensive categories.
"use client";

import { useState, useMemo } from "react";
import { X, Keyboard, Search, BookOpen } from "lucide-react";
import Link from "next/link";
import { Button } from "./ui";

export interface ShortcutGroup {
  category: string;
  items: { key: string; description: string }[];
}

export const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "Playback & Transport",
    items: [
      { key: "Space", description: "Play / Pause playback" },
      { key: "Ctrl + S", description: "Save project locally" },
      { key: "Ctrl + Z", description: "Undo last edit" },
      { key: "Ctrl + Shift + Z", description: "Redo last edit (or Ctrl + Y)" },
      { key: "Home", description: "Rewind playhead to start" },
      { key: "L", description: "Toggle continuous loop playback" },
    ],
  },
  {
    category: "Layer Quick Toggles",
    items: [
      { key: "1", description: "Toggle Chords layer on / off" },
      { key: "2", description: "Toggle Bass layer on / off" },
      { key: "3", description: "Toggle Drums layer on / off" },
      { key: "4", description: "Toggle Melody layer on / off" },
    ],
  },
  {
    category: "Drum Sequencer Matrix",
    items: [
      { key: "Tab", description: "Focus into drum matrix grid" },
      { key: "Arrow Keys", description: "Navigate between drum rows and steps" },
      { key: "Space / Enter", description: "Toggle drum pad hit on / off" },
      { key: "Home / End", description: "Jump to step 1 / step 16 in row" },
    ],
  },
  {
    category: "Harmony & Fretboard Inspection",
    items: [
      { key: "Arrow Left / Right", description: "Move between piano keys or fret dots" },
      { key: "Space / Enter", description: "Audition focused piano note or fret chord tone" },
    ],
  },
  {
    category: "Tactile Knobs & Sliders",
    items: [
      { key: "Arrow Up / Right", description: "Increase dial / slider parameter" },
      { key: "Arrow Down / Left", description: "Decrease dial / slider parameter" },
      { key: "Shift + Arrow", description: "Fine adjustment (20% step size)" },
      { key: "Home / End", description: "Snap parameter to minimum / maximum" },
    ],
  },
  {
    category: "Help & Navigation",
    items: [
      { key: "?", description: "Open / close this keyboard shortcuts cheatsheet" },
      { key: "Esc", description: "Close modal dialogs and bottom drawers" },
    ],
  },
];

export function KeyboardShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SHORTCUT_GROUPS;
    return SHORTCUT_GROUPS.map((g) => ({
      ...g,
      items: g.items.filter(
        (it) =>
          it.key.toLowerCase().includes(q) ||
          it.description.toLowerCase().includes(q) ||
          g.category.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [search]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
              <Keyboard className="h-4 w-4" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-base font-bold text-[var(--text-primary)]">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Complete tactile muscle-memory reference for SonicBlueprint
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close keyboard shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative my-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shortcuts by key or action (e.g. Space, drum, save)..."
            aria-label="Search keyboard shortcuts"
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-focus)] placeholder:text-slate-500"
          />
        </div>

        {/* Shortcuts list container */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-sm">
          {filteredGroups.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No shortcuts found matching &ldquo;{search}&rdquo;.
            </div>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.category} className="space-y-1.5">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                  {group.category}
                </h3>
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-void)]/60 p-2.5 space-y-2">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between text-[13px] gap-2">
                      <span className="text-[var(--text-secondary)]">{item.description}</span>
                      <kbd className="inline-flex items-center rounded border border-[var(--border-interactive)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)] shadow-sm shrink-0">
                        {item.key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer with documentation link */}
        <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
          <Link
            href="/tutorials"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--accent-primary)] hover:underline font-medium"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Open Video Tutorials & Masterclass</span>
          </Link>
          <Button variant="outline" size="sm" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </div>
  );
}
