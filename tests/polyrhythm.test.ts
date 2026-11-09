// Unit tests: genuine independent rhythmic cycles, polymeter, and polyrhythm timing math.
import { suite, test, eq, ok } from "./helpers";
import { buildSongEvents } from "@/lib/audio-engine";
import { createProject, validateProject, normalizeProject, type SonicProject } from "@/lib/project-schema";

suite("Drum Sequencer: Independent Rhythmic Cycles & Polyrhythms");

test("executes continuous 3-step polymeter against 16-step grid across multiple bars", () => {
  const project = createProject("Polymeter 3 vs 16 Test");
  project.config.bpm = 120; // 1 bar = 2.0s, step = 0.125s
  project.config.timeSignature = "4/4";
  project.drums.steps = 16;
  project.drums.rowCycles = {
    perc: 3, // 3-step cycle: hit on step 0, silent on 1, 2
  };

  // Clean grid: only kick on downbeats, perc on step 0
  for (const r of Object.keys(project.drums.grid) as (keyof typeof project.drums.grid)[]) {
    project.drums.grid[r] = Array.from({ length: 16 }, () => false);
  }
  project.drums.grid.kick[0] = true;
  project.drums.grid.kick[4] = true;
  project.drums.grid.kick[8] = true;
  project.drums.grid.kick[12] = true;
  project.drums.grid.perc[0] = true; // hits on step 0 of its 3-step cycle

  // 4 bars in Intro
  project.arrangement = [{ id: "intro", name: "INTRO", bars: 4, energy: 6, instruments: [] }];

  const song = buildSongEvents(project);
  const percDrums = song.drums.filter((d) => d.row === "perc").sort((a, b) => a.time - b.time);

  // In 4 bars of 16 steps = 64 steps total:
  // Perc should hit on global steps: 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42, 45, 48, 51, 54, 57, 60, 63
  // Total hits = 22 hits!
  eq(percDrums.length, 22);

  const expectedGlobalSteps = [
    0, 3, 6, 9, 12, 15, // Bar 0
    18, 21, 24, 27, 30, // Bar 1 (phases! hits on bar 1 step 2, 5, 8, 11, 14)
    33, 36, 39, 42, 45, // Bar 2 (phases! hits on bar 2 step 1, 4, 7, 10, 13)
    48, 51, 54, 57, 60, 63, // Bar 3 (re-converges on downbeat at 48!)
  ];

  const stepDur = 2.0 / 16; // 0.125s
  for (let i = 0; i < expectedGlobalSteps.length; i++) {
    const expectedTime = expectedGlobalSteps[i] * stepDur;
    const actualTime = percDrums[i].time;
    ok(
      Math.abs(actualTime - expectedTime) < 1e-5,
      `Hit #${i} should occur at ${expectedTime}s (global step ${expectedGlobalSteps[i]}), got ${actualTime}s`
    );
  }
});

test("maintains continuous polymetric phase across section boundaries without resetting", () => {
  const project = createProject("Section Boundary Polymeter Test");
  project.config.bpm = 120;
  project.drums.steps = 16;
  project.drums.rowCycles = { perc: 3 };

  for (const r of Object.keys(project.drums.grid) as (keyof typeof project.drums.grid)[]) {
    project.drums.grid[r] = Array.from({ length: 16 }, () => false);
  }
  project.drums.grid.perc[0] = true;

  // Two 1-bar sections: Section 1 is 1 bar (16 steps). Section 2 is 1 bar (16 steps).
  project.arrangement = [
    { id: "sec1", name: "VERSE", bars: 1, energy: 6, instruments: [] },
    { id: "sec2", name: "CHORUS", bars: 1, energy: 7, instruments: [] },
  ];

  const song = buildSongEvents(project);
  const percDrums = song.drums.filter((d) => d.row === "perc").sort((a, b) => a.time - b.time);

  // Total 2 bars = 32 steps. Hits at: 0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30 (11 hits).
  eq(percDrums.length, 11);

  // Check first hit in Section 2 (which starts at 2.0s = step 16)
  // Next hit after step 15 is step 18 = 18 * 0.125 = 2.25s
  const firstHitInSec2 = percDrums.find((d) => d.time >= 2.0);
  ok(firstHitInSec2 !== undefined, "Should have hits in section 2");
  ok(
    Math.abs(firstHitInSec2!.time - 2.25) < 1e-5,
    `First hit in section 2 should be at 2.25s (step 18), got ${firstHitInSec2!.time}`
  );
});

test("produces true 3:2 polyrhythm between two simultaneous drum rows", () => {
  const project = createProject("3:2 Polyrhythm Test");
  project.config.bpm = 120; // 2.0s per bar, step = 0.125s
  project.drums.steps = 16;
  project.drums.rowCycles = {
    kick: 2, // 2-step cycle
    perc: 3, // 3-step cycle
  };

  for (const r of Object.keys(project.drums.grid) as (keyof typeof project.drums.grid)[]) {
    project.drums.grid[r] = Array.from({ length: 16 }, () => false);
  }
  project.drums.grid.kick[0] = true; // hits on 0 of 2
  project.drums.grid.perc[0] = true; // hits on 0 of 3

  project.arrangement = [{ id: "intro", name: "INTRO", bars: 1, energy: 6, instruments: [] }];

  const song = buildSongEvents(project);
  const stepDur = 2.0 / 16;

  // In 16 steps:
  // Kick hits at: 0, 2, 4, 6, 8, 10, 12, 14 (8 hits)
  // Perc hits at: 0, 3, 6, 9, 12, 15 (6 hits)
  // Both hit simultaneously at: 0, 6, 12 (lcm(2, 3) = 6 steps)
  const kickHits = song.drums.filter((d) => d.row === "kick").map((d) => Math.round(d.time / stepDur));
  const percHits = song.drums.filter((d) => d.row === "perc").map((d) => Math.round(d.time / stepDur));

  eq(kickHits.join(","), "0,2,4,6,8,10,12,14");
  eq(percHits.join(","), "0,3,6,9,12,15");

  const simultaneousSteps = kickHits.filter((k) => percHits.includes(k));
  eq(simultaneousSteps.join(","), "0,6,12");
});

test("supports independent subdivision rowSteps (triplets against straight 16ths)", () => {
  const project = createProject("Independent Subdivisions Test");
  project.config.bpm = 120; // barDur = 2.0s
  project.drums.steps = 16; // master kick is 16th notes
  project.drums.rowSteps = {
    perc: 12, // perc runs at 12 steps per bar (triplet grid)
  };

  for (const r of Object.keys(project.drums.grid) as (keyof typeof project.drums.grid)[]) {
    project.drums.grid[r] = Array.from({ length: 16 }, () => false);
  }
  project.drums.grid.kick[0] = true;
  project.drums.grid.kick[4] = true;
  project.drums.grid.kick[8] = true;
  project.drums.grid.kick[12] = true; // quarter notes

  project.drums.grid.perc[0] = true;
  project.drums.grid.perc[3] = true;
  project.drums.grid.perc[6] = true;
  project.drums.grid.perc[9] = true; // dotted eighths on triplet grid

  project.arrangement = [{ id: "intro", name: "INTRO", bars: 1, energy: 6, instruments: [] }];

  const song = buildSongEvents(project);
  const kickTimes = song.drums.filter((d) => d.row === "kick").map((d) => d.time);
  const percTimes = song.drums.filter((d) => d.row === "perc").map((d) => d.time);

  // Kick quarter notes at: 0.0, 0.5, 1.0, 1.5
  eq(kickTimes.length, 4);
  ok(Math.abs(kickTimes[0] - 0.0) < 1e-5);
  ok(Math.abs(kickTimes[1] - 0.5) < 1e-5);
  ok(Math.abs(kickTimes[2] - 1.0) < 1e-5);
  ok(Math.abs(kickTimes[3] - 1.5) < 1e-5);

  // Perc 12-step division: 2.0s / 12 = 0.166667s per step
  // Hits on steps 0, 3, 6, 9:
  // Step 0: 0.0s
  // Step 3: 3 * (2/12) = 0.5s
  // Step 6: 6 * (2/12) = 1.0s
  // Step 9: 9 * (2/12) = 1.5s
  eq(percTimes.length, 4);
  ok(Math.abs(percTimes[0] - 0.0) < 1e-5);
  ok(Math.abs(percTimes[1] - 0.5) < 1e-5);
  ok(Math.abs(percTimes[2] - 1.0) < 1e-5);
  ok(Math.abs(percTimes[3] - 1.5) < 1e-5);
});

test("persists rowCycles and rowSteps through serialization and validation", () => {
  const project = createProject("Persistence Test");
  project.drums.rowCycles = { perc: 3, clap: 5, kick: 4 };
  project.drums.rowSteps = { perc: 12 };

  ok(validateProject(project), "Project with rowCycles and rowSteps must be valid");

  const json = JSON.stringify(project);
  const parsed = JSON.parse(json);
  ok(validateProject(parsed), "Parsed project JSON must be valid");

  const normalized = normalizeProject(parsed as SonicProject);
  eq(normalized.drums.rowCycles?.perc, 3);
  eq(normalized.drums.rowCycles?.clap, 5);
  eq(normalized.drums.rowCycles?.kick, 4);
  eq(normalized.drums.rowSteps?.perc, 12);
});

test("maintains full backward compatibility for projects without rowCycles", () => {
  const legacyProject = createProject("Legacy Project");
  delete (legacyProject.drums as Partial<typeof legacyProject.drums>).rowCycles;
  delete (legacyProject.drums as Partial<typeof legacyProject.drums>).rowSteps;

  ok(validateProject(legacyProject), "Legacy project without rowCycles must be valid");
  const normalized = normalizeProject(legacyProject);
  eq(normalized.drums.rowCycles, undefined);

  const song = buildSongEvents(normalized);
  ok(song.drums.length > 0, "Song events should generate cleanly");
});
