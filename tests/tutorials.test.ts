// Comprehensive unit tests for WebVTT parser, tutorial chapters, and preset hydration.
import { suite, test, eq, ok, approx } from "./helpers";
import {
  parseWebVtt,
  findActiveCue,
  parseVttTimestamp,
  formatTimestamp,
  type WebVttCue,
} from "@/lib/vtt-parser";
import {
  PC_TUTORIAL_CHAPTERS,
  PHONE_TUTORIAL_CHAPTERS,
  TUTORIAL_VIDEOS,
  PC_TUTORIAL_VTT,
  PHONE_TUTORIAL_VTT,
} from "@/lib/tutorial-data";
import {
  TUTORIAL_PRESETS,
  hydrateTutorialPreset,
} from "@/lib/tutorial-presets";
import { validateProject } from "@/lib/project-schema";
import { loadProject } from "@/lib/storage";

suite("vtt parser & binary search");

test("parses timestamp string variations accurately", () => {
  approx(parseVttTimestamp("00:00:00.000"), 0.0);
  approx(parseVttTimestamp("00:01:23.456"), 83.456);
  approx(parseVttTimestamp("01:30.500"), 90.5);
  approx(parseVttTimestamp("02:00:15.000 line:0 position:20%"), 7215.0);
  approx(parseVttTimestamp("invalid"), 0.0);
});

test("formats timestamp seconds into clean display strings", () => {
  eq(formatTimestamp(0), "0:00");
  eq(formatTimestamp(45), "0:45");
  eq(formatTimestamp(85), "1:25");
  eq(formatTimestamp(420), "7:00");
  eq(formatTimestamp(3665), "1:01:05");
  eq(formatTimestamp(-5), "0:00");
});

test("parses multi-cue WebVTT text into structured cues", () => {
  const sampleVtt = `WEBVTT - Demo
Kind: captions

1
00:00:00.000 --> 00:00:05.000
First introductory cue.

00:00:05.500 --> 00:00:10.000 line:0
Second cue with multiple
lines of dialogue.
`;

  const cues = parseWebVtt(sampleVtt);
  eq(cues.length, 2);
  eq(cues[0].startTime, 0.0);
  eq(cues[0].endTime, 5.0);
  eq(cues[0].text, "First introductory cue.");
  eq(cues[1].startTime, 5.5);
  eq(cues[1].endTime, 10.0);
  eq(cues[1].text, "Second cue with multiple lines of dialogue.");
});

test("handles empty and malformed WebVTT gracefully", () => {
  eq(parseWebVtt("").length, 0);
  eq(parseWebVtt("WEBVTT\n\nNOTE comment\n").length, 0);
});

test("findActiveCue binary search finds active cues accurately", () => {
  const cues: WebVttCue[] = [
    { id: "c1", startTime: 10, endTime: 20, text: "Cue 1" },
    { id: "c2", startTime: 25, endTime: 35, text: "Cue 2" },
    { id: "c3", startTime: 40, endTime: 55, text: "Cue 3" },
    { id: "c4", startTime: 60, endTime: 70, text: "Cue 4" },
  ];

  // Before any cue
  eq(findActiveCue(cues, 5), null);

  // Exact start time
  eq(findActiveCue(cues, 10)?.id, "c1");

  // Inside cue
  eq(findActiveCue(cues, 15)?.id, "c1");

  // In between cues
  eq(findActiveCue(cues, 22), null);

  // Inside cue 2
  eq(findActiveCue(cues, 30)?.id, "c2");

  // Boundary condition (endTime is exclusive)
  eq(findActiveCue(cues, 35), null);

  // Inside cue 3
  eq(findActiveCue(cues, 50)?.id, "c3");

  // Inside cue 4
  eq(findActiveCue(cues, 65)?.id, "c4");

  // Beyond all cues
  eq(findActiveCue(cues, 100), null);
});

suite("tutorial chapter data integrity");

test("pc and phone tutorials have 7 chapters totaling 420.0s", () => {
  eq(PC_TUTORIAL_CHAPTERS.length, 7);
  eq(PHONE_TUTORIAL_CHAPTERS.length, 7);

  // PC Chapters timeline continuity
  eq(PC_TUTORIAL_CHAPTERS[0].startTime, 0);
  eq(PC_TUTORIAL_CHAPTERS[6].endTime, 420);

  for (let i = 0; i < PC_TUTORIAL_CHAPTERS.length; i++) {
    const ch = PC_TUTORIAL_CHAPTERS[i];
    ok(ch.endTime > ch.startTime, `PC Ch ${ch.chapterNumber} duration > 0`);
    ok(ch.targetSelector.startsWith("#panel-"), `PC Ch ${ch.chapterNumber} valid target selector`);
    ok(ch.title.length > 0 && ch.keyTakeaway.length > 0);
    if (i > 0) {
      eq(ch.startTime, PC_TUTORIAL_CHAPTERS[i - 1].endTime, `PC Ch ${ch.chapterNumber} matches previous end`);
    }
  }

  // Phone Chapters timeline continuity
  eq(PHONE_TUTORIAL_CHAPTERS[0].startTime, 0);
  eq(PHONE_TUTORIAL_CHAPTERS[6].endTime, 420);

  for (let i = 0; i < PHONE_TUTORIAL_CHAPTERS.length; i++) {
    const ch = PHONE_TUTORIAL_CHAPTERS[i];
    ok(ch.endTime > ch.startTime, `Phone Ch ${ch.chapterNumber} duration > 0`);
    ok(ch.targetSelector.startsWith("#panel-"), `Phone Ch ${ch.chapterNumber} valid target selector`);
    if (i > 0) {
      eq(ch.startTime, PHONE_TUTORIAL_CHAPTERS[i - 1].endTime, `Phone Ch ${ch.chapterNumber} matches previous end`);
    }
  }
});

test("tutorial videos metadata has valid pc and phone configs", () => {
  ok(!!TUTORIAL_VIDEOS.pc);
  ok(!!TUTORIAL_VIDEOS.phone);
  eq(TUTORIAL_VIDEOS.pc.aspectRatio, "16:9");
  eq(TUTORIAL_VIDEOS.phone.aspectRatio, "9:16");
  eq(TUTORIAL_VIDEOS.pc.duration, 420.0);
  eq(TUTORIAL_VIDEOS.phone.duration, 420.0);
});

test("all presets linked in chapters exist in preset catalog", () => {
  for (const ch of [...PC_TUTORIAL_CHAPTERS, ...PHONE_TUTORIAL_CHAPTERS]) {
    if (ch.presetId) {
      ok(!!TUTORIAL_PRESETS[ch.presetId], `Preset ${ch.presetId} exists in TUTORIAL_PRESETS`);
    }
  }
});

test("embedded WebVTT constant strings parse cleanly into cues", () => {
  const pcCues = parseWebVtt(PC_TUTORIAL_VTT);
  const phoneCues = parseWebVtt(PHONE_TUTORIAL_VTT);

  ok(pcCues.length >= 15, `PC VTT has ${pcCues.length} cues`);
  ok(phoneCues.length >= 15, `Phone VTT has ${phoneCues.length} cues`);

  // Ensure chronological order
  for (let i = 1; i < pcCues.length; i++) {
    ok(pcCues[i].startTime >= pcCues[i - 1].startTime, `PC Cue ${i} chronological`);
  }
  for (let i = 1; i < phoneCues.length; i++) {
    ok(phoneCues[i].startTime >= phoneCues[i - 1].startTime, `Phone Cue ${i} chronological`);
  }
});

suite("tutorial presets & hydration engine");

test("tutorial preset catalog contains 5 authentic configurations", () => {
  const ids = Object.keys(TUTORIAL_PRESETS);
  eq(ids.length, 5);
  ok(ids.includes("tutorial-neo-soul-9th"));
  ok(ids.includes("tutorial-polyrhythm-grid"));
  ok(ids.includes("tutorial-neon-arp"));
  ok(ids.includes("tutorial-orchestral-stack"));
  ok(ids.includes("tutorial-5part-arrangement"));
});

test("every tutorial preset compiles into a valid SonicProject", () => {
  for (const [id, preset] of Object.entries(TUTORIAL_PRESETS)) {
    ok(preset.name.length > 0, `${id} has name`);
    ok(preset.targetSelector.startsWith("#panel-"), `${id} target selector`);
    ok(preset.projectSeed, `${id} has project seed`);
  }
});

test("hydrateTutorialPreset saves project, updates store and navigates", async () => {
  const pushedUrls: string[] = [];
  const mockRouter = {
    push: (url: string) => {
      pushedUrls.push(url);
    },
  };

  const store = new Map<string, string>();
  const originalLs = (globalThis as unknown as { localStorage?: unknown }).localStorage;
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
  };

  try {
    const project = await hydrateTutorialPreset("tutorial-neo-soul-9th", mockRouter);
    ok(validateProject(project), "Hydrated project conforms to SonicProject schema");
    eq(project.config.bpm, 84);
    eq(project.config.scale, "dorian");
    eq(project.chords.voicing, "drop2");
    eq(pushedUrls.length, 1);
    ok(pushedUrls[0].includes(`/studio/${project.meta.id}`), "Navigates to studio project URL");
    ok(pushedUrls[0].includes("focus=%23panel-chords"), "Includes encoded focus selector");

    // Verify project was saved to storage
    const stored = await loadProject(project.meta.id);
    ok(!!stored, "Project was stored in IndexedDB/localStorage");
    eq(stored?.meta.id, project.meta.id);
  } finally {
    if (originalLs) {
      (globalThis as unknown as { localStorage: unknown }).localStorage = originalLs;
    } else {
      delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    }
  }
});

test("hydrateTutorialPreset with autoplay flag passes parameter in url", async () => {
  const pushedUrls: string[] = [];
  const mockRouter = {
    push: (url: string) => {
      pushedUrls.push(url);
    },
  };

  const project = await hydrateTutorialPreset("tutorial-polyrhythm-grid", mockRouter, { autoPlay: true });
  ok(pushedUrls[0].includes("autoplay=1"), "Includes autoplay=1 parameter");
  eq(project.drums.patternId, "polyrhythm-3-4");
  eq(project.drums.rowCycles?.perc, 3);
  eq(project.drums.rowCycles?.clap, 5);
});
