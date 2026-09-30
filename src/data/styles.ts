// Instrument + style catalogs — data-driven so the library grows without UI rewrites.
import type { InstrumentGroupId } from "@/lib/project-schema";

export interface InstrumentDef {
  group: InstrumentGroupId;
  name: string;
  description: string;
  defaultRole: "chords" | "melody" | "arp" | "pad" | "bass" | "lead" | "texture";
  synth: "piano" | "strings" | "synth" | "pluck" | "pad" | "bass" | "guitar" | "brass" | "perc" | "atmos";
  defaultVolume: number;
}

export const INSTRUMENT_GROUPS: { id: InstrumentGroupId; label: string; hint: string }[] = [
  { id: "piano", label: "Piano", hint: "The main chords of your song" },
  { id: "guitar", label: "Guitar", hint: "Strummed or picked chord layers" },
  { id: "strings", label: "Strings", hint: "Violin-style sounds for big moments" },
  { id: "synth", label: "Synth", hint: "Electronic keyboard sounds" },
  { id: "bass", label: "Bass", hint: "The deep low notes" },
  { id: "drums", label: "Drums", hint: "Kick, snare and hats" },
  { id: "percussion", label: "Percussion", hint: "Shakers and extra rhythm sounds" },
  { id: "pads", label: "Pads", hint: "Soft background washes" },
  { id: "atmosphere", label: "Atmosphere", hint: "Airy background texture" },
  { id: "brass", label: "Brass", hint: "Trumpet-style punches" },
  { id: "plucks", label: "Plucks", hint: "Short catchy notes for tunes" },
  { id: "arps", label: "Arps", hint: "Notes that ripple up and down" },
];

export const INSTRUMENT_DEFS: InstrumentDef[] = [
  { group: "piano", name: "Grand Piano", description: "Soft felt piano for chords.", defaultRole: "chords", synth: "piano", defaultVolume: 0.8 },
  { group: "piano", name: "Bright Upright", description: "Forward pop piano.", defaultRole: "chords", synth: "piano", defaultVolume: 0.75 },
  { group: "guitar", name: "Nylon Guitar", description: "Warm fingerpicked layer.", defaultRole: "chords", synth: "guitar", defaultVolume: 0.6 },
  { group: "guitar", name: "Electric Shimmer", description: "Bright clean guitar notes.", defaultRole: "arp", synth: "guitar", defaultVolume: 0.55 },
  { group: "strings", name: "String Ensemble", description: "Smooth strings that rise and fall.", defaultRole: "pad", synth: "strings", defaultVolume: 0.6 },
  { group: "strings", name: "Solo Cello", description: "A singing low string melody.", defaultRole: "melody", synth: "strings", defaultVolume: 0.65 },
  { group: "synth", name: "Analog Saw", description: "Bright buzzy synth sound.", defaultRole: "arp", synth: "synth", defaultVolume: 0.6 },
  { group: "synth", name: "Soft Square", description: "Smooth synth for tunes.", defaultRole: "lead", synth: "synth", defaultVolume: 0.6 },
  { group: "bass", name: "Sub Bass", description: "Deep simple bass you feel in your chest.", defaultRole: "bass", synth: "bass", defaultVolume: 0.85 },
  { group: "bass", name: "Electric Bass", description: "Plucky mid bass.", defaultRole: "bass", synth: "bass", defaultVolume: 0.8 },
  { group: "pads", name: "Warm Pad", description: "Soft background wash that fades in slowly.", defaultRole: "pad", synth: "pad", defaultVolume: 0.55 },
  { group: "pads", name: "Glass Pad", description: "Airy high pad.", defaultRole: "pad", synth: "pad", defaultVolume: 0.5 },
  { group: "atmosphere", name: "Night Air", description: "Soft airy background sound.", defaultRole: "texture", synth: "atmos", defaultVolume: 0.3 },
  { group: "brass", name: "Brass Stabs", description: "Short punchy bursts for big moments.", defaultRole: "chords", synth: "brass", defaultVolume: 0.6 },
  { group: "plucks", name: "Night Pluck", description: "Catchy short notes for tunes.", defaultRole: "melody", synth: "pluck", defaultVolume: 0.6 },
  { group: "arps", name: "Crystal Arp", description: "Notes that ripple up and down.", defaultRole: "arp", synth: "pluck", defaultVolume: 0.55 },
  { group: "percussion", name: "Shaker Bed", description: "Extra ticking rhythm underneath.", defaultRole: "texture", synth: "perc", defaultVolume: 0.4 },
];

export interface BassStyle { id: string; label: string; description: string; }
export const BASS_STYLES: BassStyle[] = [
  { id: "root", label: "Steady roots", description: "Plays each chord's home note as it changes. Reliable and clean." },
  { id: "octave", label: "Bouncy octaves", description: "Jumps between low and higher versions of each home note." },
  { id: "sustained", label: "Long held notes", description: "Stretches each note out — spacious and cinematic." },
  { id: "rhythmic", label: "Driving pulse", description: "Repeats in a steady rhythm you can draw below." },
  { id: "arp", label: "Rolling notes", description: "Cycles through each chord's notes one by one." },
  { id: "sub", label: "Deep rumble", description: "Very low and minimal — felt more than heard." },
  { id: "electronic", label: "Syncopated groove", description: "Off-beat electronic bounce you can redraw below." },
  { id: "custom", label: "Your own rhythm", description: "Draw exactly when the bass plays in the grid below." },
];

export interface MelodyStyle { id: string; label: string; description: string; density: number; }
export const MELODY_STYLES: MelodyStyle[] = [
  { id: "gentle", label: "Gentle", description: "Calm and sparse — easy to sing along to.", density: 0.45 },
  { id: "flowing", label: "Flowing", description: "Smooth, step-by-step tune with medium movement.", density: 0.6 },
  { id: "anthemic", label: "Anthemic", description: "Big long notes that land on the strong beats.", density: 0.4 },
  { id: "rhythmic", label: "Bouncy", description: "Short off-beat phrases with lots of rhythm.", density: 0.75 },
  { id: "minimal", label: "Minimal", description: "Just two or three notes per chord. Lots of air.", density: 0.3 },
  { id: "ornate", label: "Decorated", description: "Busy flourishes for dramatic moments.", density: 0.85 },
];

export const MOODS = [
  "Dark", "Emotional", "Hopeful", "Powerful", "Energetic", "Dreamy",
  "Mysterious", "Cinematic", "Aggressive", "Melancholic", "Uplifting",
  "Euphoric", "Tense", "Peaceful",
] as const;

export const TIME_SIGNATURES = ["4/4", "3/4", "6/8", "12/8"] as const;

export interface QuickStart {
  id: string;
  title: string;
  tagline: string;
  mood: string;
  bpm: number;
  tonic: string;
  scale: "major" | "minor";
  progressionId: string;
  drumId: string;
  bassStyle: string;
  energy: number;
}

export const QUICK_STARTS: QuickStart[] = [
  { id: "qs-cinematic-pop", title: "Cinematic Pop", tagline: "Wide strings over a driving pulse.", mood: "Cinematic", bpm: 100, tonic: "D", scale: "minor", progressionId: "cinematic-i-v-vi-iv-big", drumId: "cinematic-pulse", bassStyle: "sustained", energy: 7 },
  { id: "qs-dark-pop", title: "Dark Pop", tagline: "Moody minor loop, half-time kit.", mood: "Dark", bpm: 92, tonic: "E", scale: "minor", progressionId: "dark-i-bVII-bVI-bVII", drumId: "pop-half-time", bassStyle: "sub", energy: 6 },
  { id: "qs-electronic-pop", title: "Electronic Pop", tagline: "Neon synths, tight groove.", mood: "Energetic", bpm: 116, tonic: "C", scale: "major", progressionId: "pop-vi-V-IV-V", drumId: "electro-clap", bassStyle: "electronic", energy: 7 },
  { id: "qs-ballad", title: "Emotional Ballad", tagline: "Piano confession in 4/4.", mood: "Emotional", bpm: 72, tonic: "A", scale: "minor", progressionId: "emotional-vi-ii-V-I", drumId: "minimal-tick", bassStyle: "sustained", energy: 4 },
  { id: "qs-anthem", title: "Powerful Anthem", tagline: "Stadium chords, power kit.", mood: "Powerful", bpm: 128, tonic: "G", scale: "major", progressionId: "uplifting-I-V-vi-IV", drumId: "pop-power", bassStyle: "root", energy: 9 },
  { id: "qs-dream-pop", title: "Dream Pop", tagline: "Hazy guitars and soft pulse.", mood: "Dreamy", bpm: 88, tonic: "F", scale: "major", progressionId: "dreamy-I-iii-IV-V", drumId: "synthpop-ballad", bassStyle: "root", energy: 4 },
  { id: "qs-rock", title: "Rock", tagline: "Straight backbeat, iron riff.", mood: "Aggressive", bpm: 132, tonic: "E", scale: "minor", progressionId: "powerful-i-bVII-i-VI", drumId: "rock-backbeat", bassStyle: "rhythmic", energy: 8 },
  { id: "qs-alternative", title: "Alternative", tagline: "Off-kilter lift, live feel.", mood: "Mysterious", bpm: 104, tonic: "B", scale: "minor", progressionId: "emotional-i-bIII-iv-VI", drumId: "rock-anthem", bassStyle: "octave", energy: 6 },
  { id: "qs-synth-pop", title: "Synth Pop", tagline: "Arps over neon drums.", mood: "Euphoric", bpm: 108, tonic: "C", scale: "major", progressionId: "pop-vi-V-IV-V", drumId: "synthpop-neon", bassStyle: "arp", energy: 7 },
  { id: "qs-cinematic-electronic", title: "Cinematic Electronic", tagline: "Hybrid orchestra + pulse.", mood: "Cinematic", bpm: 96, tonic: "D", scale: "minor", progressionId: "cinematic-i-iv-bVII-bIII", drumId: "hybrid-orch", bassStyle: "sub", energy: 7 },
  { id: "qs-trap", title: "Trap-inspired", tagline: "Two-chord menace, rolling hats.", mood: "Tense", bpm: 140, tonic: "F", scale: "minor", progressionId: "trap-i-VI-i-VI", drumId: "trap-half", bassStyle: "sub", energy: 7 },
  { id: "qs-ambient", title: "Ambient", tagline: "Still water, barely-there drums.", mood: "Peaceful", bpm: 70, tonic: "C", scale: "major", progressionId: "ambient-i-iii-i-VI", drumId: "ambient-wash", bassStyle: "sustained", energy: 2 },
  { id: "qs-custom", title: "Custom", tagline: "Blank canvas, full manual control.", mood: "Emotional", bpm: 100, tonic: "D", scale: "minor", progressionId: "emotional-i-vi-iii-vii", drumId: "pop-four-floor", bassStyle: "root", energy: 6 },
];
