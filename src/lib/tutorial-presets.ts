// "Try in Studio" Tutorial Presets and Hydration Engine.

import { createProject, defaultDrumGrid, normalizeProject, type SonicProject } from "./project-schema";
import { saveProject } from "./storage";
import { useProjectStore } from "@/store/project-store";

export interface TutorialPreset {
  id: string;
  name: string;
  description: string;
  chapterId: string;
  targetSelector: string;
  projectSeed: Partial<SonicProject>;
}

export const TUTORIAL_PRESETS: Record<string, TutorialPreset> = {
  "tutorial-neo-soul-9th": {
    id: "tutorial-neo-soul-9th",
    name: "Tutorial: Neo-Soul 9th Voicings",
    description: "E♭ Dorian 9th chords with drop-2 jazz voicing, grand piano and warm analog pads.",
    chapterId: "pc-ch2-chords",
    targetSelector: "#panel-chords",
    projectSeed: {
      config: {
        bpm: 84,
        keyTonic: "Eb",
        scale: "dorian",
        mood: "Soul / R&B",
        energy: 5,
        dynamics: 6,
        humanize: "natural",
        timeSignature: "4/4",
      },
      chords: {
        progressionId: "neo-soul-eb-dorian",
        chords: ["Ebmaj9", "Dbmaj9", "Cm9", "Fm9"],
        beatsPerChord: 4,
        octave: 3,
        voicing: "drop2",
      },
      instruments: [
        {
          id: "inst_piano",
          group: "piano",
          name: "Grand Piano",
          enabled: true,
          volume: 0.8,
          pan: -0.15,
          octave: 0,
          role: "chords",
          style: "soft",
          patternVariant: "block",
        },
        {
          id: "inst_guitar",
          group: "guitar",
          name: "Nylon Guitar",
          enabled: true,
          volume: 0.7,
          pan: 0.25,
          octave: 0,
          role: "chords",
          style: "warm",
          patternVariant: "broken",
        },
        {
          id: "inst_pad",
          group: "pads",
          name: "Warm Pad",
          enabled: true,
          volume: 0.65,
          pan: 0,
          octave: 0,
          role: "pad",
          style: "warm",
          patternVariant: "sustain",
        },
        {
          id: "inst_bass",
          group: "bass",
          name: "Sub Bass",
          enabled: true,
          volume: 0.85,
          pan: 0,
          octave: 0,
          role: "bass",
          style: "sub",
          patternVariant: "root",
        },
      ],
      drums: (() => {
        const grid = defaultDrumGrid(16);
        [0, 8].forEach((i) => (grid.kick[i] = true));
        [4, 12].forEach((i) => (grid.snare[i] = true));
        for (let i = 0; i < 16; i += 2) grid.hihat[i] = true;
        grid.perc[6] = true;
        grid.perc[14] = true;
        return {
          patternId: "neo-soul-chill",
          steps: 16,
          grid,
          swing: 0.25,
          velocity: 0.85,
        };
      })(),
    },
  },

  "tutorial-polyrhythm-grid": {
    id: "tutorial-polyrhythm-grid",
    name: "Tutorial: Polyrhythmic Percussion Grid",
    description: "16-step grid combining 4-on-the-floor kick, 3-step perc, and 5-step clap for continuous poly-meter evolution.",
    chapterId: "pc-ch3-drums",
    targetSelector: "#panel-drums",
    projectSeed: {
      config: {
        bpm: 120,
        keyTonic: "C",
        scale: "minor",
        mood: "Electronic / Dance",
        energy: 7,
        dynamics: 7,
        humanize: "subtle",
        timeSignature: "4/4",
      },
      drums: (() => {
        const grid = defaultDrumGrid(16);
        [0, 4, 8, 12].forEach((i) => (grid.kick[i] = true));
        [4, 12].forEach((i) => (grid.snare[i] = true));
        for (let i = 0; i < 16; i += 2) grid.hihat[i] = true;
        [0, 3, 6, 9, 12, 15].forEach((i) => (grid.perc[i] = true));
        [0, 5, 10, 15].forEach((i) => (grid.clap[i] = true));
        const accents = Array.from({ length: 16 }, (_, i) => i % 4 === 0);
        return {
          patternId: "polyrhythm-3-4",
          steps: 16,
          grid,
          swing: 0.15,
          velocity: 0.9,
          accents,
          rowCycles: { kick: 4, perc: 3, clap: 5 },
          rowSteps: { kick: 16, perc: 12, clap: 10, snare: 16, hihat: 16 },
        };
      })(),
    },
  },

  "tutorial-neon-arp": {
    id: "tutorial-neon-arp",
    name: "Tutorial: Neon Bass & Arpeggiator",
    description: "Syncopated 1/16 pattern arpeggiator in C Major locked with electronic punch bass.",
    chapterId: "pc-ch4-bass",
    targetSelector: "#panel-bass",
    projectSeed: {
      config: {
        bpm: 112,
        keyTonic: "C",
        scale: "major",
        mood: "Synthwave / Neon",
        energy: 7,
        dynamics: 7,
        humanize: "subtle",
        timeSignature: "4/4",
      },
      chords: {
        progressionId: "pop-vi-iv-i-v",
        chords: ["Am", "F", "C", "G"],
        beatsPerChord: 4,
        octave: 3,
        voicing: "root",
      },
      bass: {
        styleId: "electronic",
        octave: 1,
        volume: 0.9,
        pattern: [true, false, true, false, true, true, false, true, false, true, false, true, true, false, true, false],
      },
      instruments: [
        {
          id: "inst_synth_arp",
          group: "synth",
          name: "Analog Synth",
          enabled: true,
          volume: 0.75,
          pan: 0.15,
          octave: 1,
          role: "arp",
          style: "bright",
          patternVariant: "arp-up",
          arpeggiator: {
            enabled: true,
            pattern: "upDown",
            rate: "1/16",
            octaves: 2,
            gate: 0.8,
          },
        },
        {
          id: "inst_piano",
          group: "piano",
          name: "Grand Piano",
          enabled: true,
          volume: 0.7,
          pan: -0.2,
          octave: 0,
          role: "chords",
          style: "soft",
          patternVariant: "block",
        },
        {
          id: "inst_bass",
          group: "bass",
          name: "Sub Bass",
          enabled: true,
          volume: 0.85,
          pan: 0,
          octave: 0,
          role: "bass",
          style: "electronic",
          patternVariant: "root",
        },
      ],
    },
  },

  "tutorial-orchestral-stack": {
    id: "tutorial-orchestral-stack",
    name: "Tutorial: Orchestral Master FX Stack",
    description: "Convolver hall reverb, 4:1 bus compressor, and master 3-band parametric EQ.",
    chapterId: "pc-ch7-effects",
    targetSelector: "#panel-effects",
    projectSeed: {
      config: {
        bpm: 96,
        keyTonic: "D",
        scale: "minor",
        mood: "Cinematic / Drama",
        energy: 8,
        dynamics: 8,
        humanize: "natural",
        timeSignature: "4/4",
      },
      chords: {
        progressionId: "cinematic-d-minor",
        chords: ["Dm", "Bb", "Gm", "A7"],
        beatsPerChord: 4,
        octave: 3,
        voicing: "open",
      },
      effects: {
        reverb: { enabled: true, decay: 2.8, mix: 0.35, tone: 4500 },
        delay: { enabled: true, time: 0.375, feedback: 0.4, mix: 0.25 },
        compressor: {
          enabled: true,
          threshold: -18,
          ratio: 4,
          attack: 0.02,
          release: 0.25,
          knee: 6,
          makeupGain: 4,
          autoMakeup: false,
        },
        eq: { enabled: true, lowGain: 2, midGain: -1.5, highGain: 3 },
        modulation: { enabled: false, type: "chorus", rate: 1, depth: 0.5, feedback: 0, mix: 0.3 },
      },
      instruments: [
        {
          id: "inst_piano",
          group: "piano",
          name: "Grand Piano",
          enabled: true,
          volume: 0.8,
          pan: 0,
          octave: 0,
          role: "chords",
          style: "soft",
          patternVariant: "block",
        },
        {
          id: "inst_strings",
          group: "strings",
          name: "String Ensemble",
          enabled: true,
          volume: 0.75,
          pan: -0.25,
          octave: 0,
          role: "pad",
          style: "legato",
          patternVariant: "sustain",
        },
        {
          id: "inst_cello",
          group: "strings",
          name: "Solo Cello",
          enabled: true,
          volume: 0.7,
          pan: 0.2,
          octave: 0,
          role: "melody",
          style: "expressive",
          patternVariant: "melody",
        },
        {
          id: "inst_winds",
          group: "winds",
          name: "French Horn",
          enabled: true,
          volume: 0.65,
          pan: 0.1,
          octave: -1,
          role: "pad",
          style: "warm",
          patternVariant: "sustain",
        },
      ],
    },
  },

  "tutorial-5part-arrangement": {
    id: "tutorial-5part-arrangement",
    name: "Tutorial: 5-Part Dynamic Arrangement",
    description: "Full dynamic song structure spanning Intro to Outro with automated energy curves from 3 to 9.",
    chapterId: "pc-ch6-structure",
    targetSelector: "#panel-structure",
    projectSeed: {
      config: {
        bpm: 104,
        keyTonic: "D",
        scale: "minor",
        mood: "Pop / Modern",
        energy: 6,
        dynamics: 7,
        humanize: "subtle",
        timeSignature: "4/4",
      },
      arrangement: [
        { id: "sec_intro", name: "INTRO", bars: 4, energy: 3, instruments: [] },
        { id: "sec_verse", name: "VERSE", bars: 8, energy: 5, instruments: [] },
        { id: "sec_chorus", name: "CHORUS", bars: 8, energy: 8, instruments: [] },
        { id: "sec_bridge", name: "BRIDGE", bars: 4, energy: 6, instruments: [] },
        { id: "sec_final_chorus", name: "FINAL CHORUS", bars: 8, energy: 9, instruments: [] },
        { id: "sec_outro", name: "OUTRO", bars: 4, energy: 4, instruments: [] },
      ],
    },
  },
};

/**
 * Hydrates an authentic project from a tutorial preset, saves it to persistent storage,
 * loads it into the editor store, and navigates directly to the studio focused on the target panel.
 */
export async function hydrateTutorialPreset(
  presetId: string,
  router: { push: (url: string) => void },
  options?: { autoPlay?: boolean }
): Promise<SonicProject> {
  const preset = TUTORIAL_PRESETS[presetId];
  if (!preset) {
    throw new Error(`Unknown tutorial preset: ${presetId}`);
  }

  const project = normalizeProject(createProject(preset.name, preset.projectSeed));
  await saveProject(project);

  if (typeof window !== "undefined") {
    try {
      useProjectStore.getState().load(project);
      localStorage.setItem("sb:last-edited", project.meta.id);
    } catch {
      // ignore
    }
  }

  const targetUrl = `/studio/${project.meta.id}?focus=${encodeURIComponent(preset.targetSelector)}${options?.autoPlay ? "&autoplay=1" : ""}`;
  router.push(targetUrl);
  return project;
}
