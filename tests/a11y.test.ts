// Unit tests for WCAG 2.1 AA accessibility announcer, keyboard shortcut registry, and roving tabindex math.

import { suite, test, ok, eq } from "./helpers.js";
import {
  announce,
  subscribeAnnouncer,
  announceTransport,
  announceTempo,
  announcePreset,
  announceSequencer,
} from "../src/lib/a11y-announcer.js";
import { SHORTCUT_GROUPS } from "../src/components/KeyboardShortcutsModal.js";

suite("a11y-announcer");

test("dispatches polite announcements to subscribers", () => {
  let receivedMessage = "";
  let receivedPriority = "";

  const unsubscribe = subscribeAnnouncer((payload) => {
    receivedMessage = payload.message;
    receivedPriority = payload.priority;
  });

  try {
    announce("Testing polite speech", "polite");
    eq(receivedMessage, "Testing polite speech", "Should receive published polite message");
    eq(receivedPriority, "polite", "Priority should be polite");
  } finally {
    unsubscribe();
  }
});

test("dispatches assertive announcements with high priority", () => {
  let receivedMessage = "";
  let receivedPriority = "";

  const unsubscribe = subscribeAnnouncer((payload) => {
    receivedMessage = payload.message;
    receivedPriority = payload.priority;
  });

  try {
    announce("Playback started", "assertive");
    eq(receivedMessage, "Playback started", "Should receive published assertive message");
    eq(receivedPriority, "assertive", "Priority should be assertive");
  } finally {
    unsubscribe();
  }
});

test("unsubscribe cleanly stops dispatches", () => {
  let callCount = 0;
  const unsubscribe = subscribeAnnouncer(() => {
    callCount++;
  });

  announce("First message");
  eq(callCount, 1, "Should receive first message");

  unsubscribe();
  announce("Second message");
  eq(callCount, 1, "Call count should remain 1 after unsubscribe");
});

test("announceTransport formats correct verbalizations", () => {
  const messages: string[] = [];
  const unsubscribe = subscribeAnnouncer((payload) => {
    messages.push(payload.message);
  });

  try {
    announceTransport("playing");
    announceTransport("paused");
    announceTransport("stopped");

    eq(messages.length, 3, "Should receive 3 transport messages");
    eq(messages[0], "Playback started");
    eq(messages[1], "Playback paused");
    eq(messages[2], "Playback stopped");
  } finally {
    unsubscribe();
  }
});

test("announcePreset formats loaded preset message", () => {
  const messages: string[] = [];
  const unsubscribe = subscribeAnnouncer((payload) => {
    messages.push(payload.message);
  });

  try {
    announcePreset("Neo-Soul 9th");
    announcePreset("Boom-Bap Grid");

    eq(messages.length, 2, "Should receive 2 preset messages");
    eq(messages[0], "Loaded preset Neo-Soul 9th");
    eq(messages[1], "Loaded preset Boom-Bap Grid");
  } finally {
    unsubscribe();
  }
});

test("announceSequencer formats voice, step index, and active state", () => {
  const messages: string[] = [];
  const unsubscribe = subscribeAnnouncer((payload) => {
    messages.push(payload.message);
  });

  try {
    announceSequencer("Kick", 0, true);
    announceSequencer("Snare", 4, false);

    eq(messages.length, 2, "Should receive 2 sequencer announcements");
    eq(messages[0], "Kick step 1 on");
    eq(messages[1], "Snare step 5 off");
  } finally {
    unsubscribe();
  }
});

suite("keyboard-shortcuts-catalog");

test("has 6 comprehensive categories", () => {
  eq(SHORTCUT_GROUPS.length, 6, "Must define exactly 6 shortcut categories");
  const categories = SHORTCUT_GROUPS.map((g) => g.category);
  ok(categories.includes("Playback & Transport"), "Should include Playback & Transport");
  ok(categories.includes("Layer Quick Toggles"), "Should include Layer Quick Toggles");
  ok(categories.includes("Drum Sequencer Matrix"), "Should include Drum Sequencer Matrix");
  ok(categories.includes("Harmony & Fretboard Inspection"), "Should include Harmony & Fretboard Inspection");
  ok(categories.includes("Tactile Knobs & Sliders"), "Should include Tactile Knobs & Sliders");
  ok(categories.includes("Help & Navigation"), "Should include Help & Navigation");
});

test("every category has at least 2 shortcuts with valid keys and descriptions", () => {
  for (const group of SHORTCUT_GROUPS) {
    ok(group.items.length >= 2, `${group.category} must have at least 2 shortcut items`);
    for (const item of group.items) {
      ok(item.key.trim().length > 0, `Key in ${group.category} must not be empty`);
      ok(item.description.trim().length > 0, `Description for ${item.key} must not be empty`);
    }
  }
});

test("search filtering matches keys and descriptions case-insensitively", () => {
  const query = "play";
  const filtered = SHORTCUT_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter(
      (item) =>
        item.key.toLowerCase().includes(query.toLowerCase()) ||
        item.description.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((g) => g.items.length > 0);

  ok(filtered.length > 0, "Should find matches for query 'play'");
  const spaceItem = filtered.flatMap((g) => g.items).find((i) => i.key === "Space");
  ok(spaceItem !== undefined, "Should match 'Space' shortcut");
});

suite("roving-tabindex-bounds");

test("8x16 sequencer grid navigation bounds clamping", () => {
  const ROWS = 8;
  const COLS = 16;

  function moveCell(r: number, c: number, dr: number, dc: number): [number, number] {
    const nextR = Math.max(0, Math.min(ROWS - 1, r + dr));
    const nextC = Math.max(0, Math.min(COLS - 1, c + dc));
    return [nextR, nextC];
  }

  // Clamping at boundaries
  eq(moveCell(0, 0, -1, 0), [0, 0], "Cannot move above row 0");
  eq(moveCell(0, 0, 0, -1), [0, 0], "Cannot move left of col 0");
  eq(moveCell(7, 15, 1, 0), [7, 15], "Cannot move below row 7");
  eq(moveCell(7, 15, 0, 1), [7, 15], "Cannot move right of col 15");

  // Valid internal moves
  eq(moveCell(2, 4, 1, 0), [3, 4], "Move down one row");
  eq(moveCell(2, 4, 0, 1), [2, 5], "Move right one col");
});

test("37-key piano navigation chromatic and octave clamp", () => {
  const TOTAL_KEYS = 37; // 3 octaves C3 to C6

  function navigatePiano(currentIdx: number, delta: number): number {
    return Math.max(0, Math.min(TOTAL_KEYS - 1, currentIdx + delta));
  }

  // Chromatic moves (+/- 1)
  eq(navigatePiano(0, -1), 0, "Cannot move below key 0");
  eq(navigatePiano(36, 1), 36, "Cannot move above key 36");
  eq(navigatePiano(10, 1), 11, "Chromatic step up");
  eq(navigatePiano(10, -1), 9, "Chromatic step down");

  // Octave moves (+/- 12)
  eq(navigatePiano(5, -12), 0, "Octave step down clamps to 0");
  eq(navigatePiano(30, 12), 36, "Octave step up clamps to 36");
  eq(navigatePiano(12, 12), 24, "Octave step up");
  eq(navigatePiano(24, -12), 12, "Octave step down");
});
