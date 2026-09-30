// Drum pattern library — data-driven step presets.
import type { DrumConfig } from "@/lib/project-schema";
import { defaultDrumGrid } from "@/lib/project-schema";
import type { DrumRow } from "@/lib/project-schema";

export interface DrumPreset {
  id: string;
  name: string;
  category: "Electronic Pop" | "Cinematic" | "Rock" | "Trap-inspired" | "Minimal" | "Dance" | "Hybrid" | "Ambient" | "Powerful Pop" | "Synth Pop";
  steps: number;
  description: string;
  bpmSuggestion: [number, number];
  build: () => DrumConfig;
}

function mk(
  id: string, name: string, category: DrumPreset["category"],
  steps: number, description: string, bpmSuggestion: [number, number],
  paint: (grid: Record<DrumRow, boolean[]>) => void,
  swing = 0
): DrumPreset {
  return {
    id, name, category, steps, description, bpmSuggestion,
    build: () => {
      const grid = defaultDrumGrid(steps);
      paint(grid);
      return { patternId: id, steps, grid, swing, velocity: 0.9 };
    },
  };
}

export const DRUM_PRESETS: DrumPreset[] = [
  mk("pop-four-floor", "Four on the Floor", "Electronic Pop", 16, "Classic dance-pop kick with backbeat snare.", [100, 128], (g) => {
    [0, 4, 8, 12].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => (g.snare[i] = true));
    for (let i = 0; i < 16; i += 2) g.hihat[i] = true;
    g.openhat[14] = true;
  }),
  mk("pop-half-time", "Half-Time Pop", "Powerful Pop", 16, "Spacious half-time groove for verses.", [70, 95], (g) => {
    [0, 10].forEach((i) => (g.kick[i] = true));
    g.snare[8] = true;
    for (let i = 0; i < 16; i += 4) g.hihat[i] = true;
    g.shaker[2] = g.shaker[6] = g.shaker[10] = g.shaker[14] = true;
  }),
  mk("pop-power", "Power Pop Drive", "Powerful Pop", 16, "Driving chorus groove with claps.", [120, 140], (g) => {
    [0, 4, 8, 12, 14].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => { g.snare[i] = true; g.clap[i] = true; });
    for (let i = 0; i < 16; i++) g.hihat[i] = i % 2 === 0;
    g.shaker[0] = g.shaker[4] = g.shaker[8] = g.shaker[12] = true;
  }),
  mk("cinematic-boom", "Cinematic Boom", "Cinematic", 16, "Taiko-like booms with sparse metal.", [60, 90], (g) => {
    g.kick[0] = g.kick[7] = g.kick[10] = true;
    g.tom[0] = g.tom[7] = g.tom[10] = g.tom[12] = true;
    g.perc[4] = g.perc[12] = true;
    g.shaker[14] = true;
  }),
  mk("cinematic-pulse", "Cinematic Pulse", "Cinematic", 16, "Ticking pulse under trailer hits.", [80, 110], (g) => {
    for (let i = 0; i < 16; i++) g.perc[i] = i % 2 === 0;
    g.kick[0] = g.kick[8] = true;
    g.snare[8] = true;
    g.tom[12] = g.tom[14] = true;
  }),
  mk("rock-backbeat", "Rock Backbeat", "Rock", 16, "Straight rock kit.", [110, 150], (g) => {
    [0, 8, 10].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => (g.snare[i] = true));
    for (let i = 0; i < 16; i += 2) g.hihat[i] = true;
    g.openhat[12] = true;
  }),
  mk("rock-anthem", "Anthem Rock", "Rock", 16, "Big toms and crashes for choruses.", [100, 130], (g) => {
    [0, 4, 8, 12].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => (g.snare[i] = true));
    g.tom[6] = g.tom[14] = g.tom[15] = true;
    for (let i = 0; i < 16; i += 2) g.hihat[i] = true;
  }),
  mk("trap-half", "Trap Half-Time", "Trap-inspired", 16, "Rolling hats, deep 808-style kick.", [130, 150], (g) => {
    g.kick[0] = g.kick[7] = g.kick[10] = true;
    g.snare[8] = true;
    for (let i = 0; i < 16; i++) g.hihat[i] = true;
    g.hihat[3] = g.hihat[6] = g.hihat[11] = true;
    g.perc[14] = true;
  }, 0.12),
  mk("trap-dark", "Dark Trap", "Trap-inspired", 16, "Sparse and menacing.", [65, 80], (g) => {
    g.kick[0] = g.kick[10] = true;
    g.snare[8] = true;
    for (let i = 0; i < 16; i += 2) g.hihat[i] = true;
    g.openhat[7] = true;
    g.perc[5] = g.perc[13] = true;
  }, 0.15),
  mk("minimal-tick", "Minimal Tick", "Minimal", 16, "Bare pulse for intimate verses.", [80, 100], (g) => {
    g.kick[0] = g.kick[8] = true;
    g.hihat[0] = g.hihat[8] = true;
    g.shaker[4] = g.shaker[12] = true;
  }),
  mk("minimal-pulse", "Soft Pulse", "Minimal", 8, "Eight-step breathing groove.", [70, 90], (g) => {
    g.kick[0] = g.kick[4] = true;
    g.perc[2] = g.perc[6] = true;
    g.shaker[0] = g.shaker[2] = g.shaker[4] = g.shaker[6] = true;
  }),
  mk("dance-house", "House Groove", "Dance", 16, "Off-beat hats, driving kick.", [118, 128], (g) => {
    [0, 4, 8, 12].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => { g.clap[i] = true; });
    for (let i = 0; i < 16; i++) g.openhat[i] = i % 4 === 2;
    for (let i = 0; i < 16; i += 2) g.hihat[i] = true;
  }),
  mk("dance-synthwave", "Synthwave Drive", "Dance", 16, "Gated 80s drive.", [95, 115], (g) => {
    [0, 4, 8, 12].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => (g.snare[i] = true));
    for (let i = 0; i < 16; i++) g.hihat[i] = i % 2 === 1;
    g.tom[14] = true;
  }),
  mk("hybrid-orch", "Hybrid Orchestra", "Hybrid", 16, "Electronic kit fused with percussion.", [90, 120], (g) => {
    g.kick[0] = g.kick[6] = g.kick[8] = g.kick[14] = true;
    g.snare[4] = g.snare[12] = true;
    g.tom[0] = g.tom[8] = g.tom[15] = true;
    for (let i = 0; i < 16; i += 4) g.perc[i] = true;
    for (let i = 0; i < 16; i += 2) g.shaker[i] = true;
  }),
  mk("ambient-wash", "Ambient Wash", "Ambient", 16, "Almost no drums; soft shaker tide.", [60, 80], (g) => {
    g.kick[0] = true;
    for (let i = 0; i < 16; i += 8) g.shaker[i] = true;
    g.perc[8] = true;
  }),
  mk("ambient-heartbeat", "Heartbeat", "Ambient", 8, "Low thump like a heartbeat.", [60, 75], (g) => {
    g.kick[0] = g.kick[3] = true;
    g.shaker[0] = g.shaker[4] = true;
  }),
  mk("synthpop-neon", "Neon Pop", "Synth Pop", 16, "Tight electronic pop.", [100, 118], (g) => {
    [0, 4, 8, 12].forEach((i) => (g.kick[i] = true));
    [4, 12].forEach((i) => { g.snare[i] = true; g.clap[i] = true; });
    for (let i = 0; i < 16; i++) g.hihat[i] = i % 4 !== 3;
    g.openhat[6] = g.openhat[14] = true;
  }),
  mk("synthpop-ballad", "Synth Ballad", "Synth Pop", 16, "Soft machine groove.", [75, 92], (g) => {
    g.kick[0] = g.kick[8] = g.kick[10] = true;
    g.snare[8] = true;
    g.clap[8] = true;
    for (let i = 0; i < 16; i += 4) g.hihat[i] = true;
    g.shaker[2] = g.shaker[6] = g.shaker[10] = g.shaker[14] = true;
  }),
  mk("electro-clap", "Electro Clap", "Electronic Pop", 16, "Clap-led electronic bounce.", [110, 125], (g) => {
    g.kick[0] = g.kick[5] = g.kick[8] = g.kick[13] = true;
    [4, 12].forEach((i) => (g.clap[i] = true));
    for (let i = 0; i < 16; i += 2) g.hihat[i] = true;
    g.perc[7] = g.perc[15] = true;
  }, 0.08),
  mk("cinematic-68", "Cinematic 6/8", "Cinematic", 12, "Twelve-step flow for 6/8 ballads.", [70, 100], (g) => {
    g.kick[0] = g.kick[6] = true;
    g.snare[6] = true;
    for (let i = 0; i < 12; i += 2) g.shaker[i] = true;
    g.perc[3] = g.perc[9] = true;
  }),
];

export const DRUM_CATEGORIES = [
  "Electronic Pop", "Cinematic", "Rock", "Trap-inspired", "Minimal",
  "Dance", "Hybrid", "Ambient", "Powerful Pop", "Synth Pop",
] as const;
