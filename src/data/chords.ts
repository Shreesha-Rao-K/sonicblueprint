// Structured chord progression library — data-driven, transposable.
// Each entry stores semitone-relative patterns so UI transposes automatically.

export interface ChordProgressionPreset {
  id: string;
  name: string;
  category: "emotional" | "cinematic" | "dark" | "uplifting" | "pop" | "dramatic" | "tension" | "resolution" | "dreamy" | "powerful";
  roman: string; // e.g. "i – VI – III – VII"
  chordsInC: string[]; // reference spelling in C major / A minor context
  minorContext: boolean; // true => chordsInC are in minor context
  moodTags: string[];
  difficulty: "easy" | "medium" | "advanced";
  bars: number;
  description: string;
  energy: number; // 1..10 suggestion
}

// Helper: transpose a reference chord by semitones (simple parser for library use)
import { transposeChord } from "@/lib/music-theory";

const PC: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5,
  "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11,
};

export function transposeLibraryChords(chords: string[], semitones: number): string[] {
  return chords.map((c) => transposeChord(c, semitones));
}

/** Semitone offset of a tonic vs C (for major) or A (for minor context). */
export function tonicOffset(tonic: string, minorContext: boolean): number {
  const norm = tonic.trim();
  const pc = PC[norm] ?? PC[norm.replace("♭", "b").replace("♯", "#")] ?? 0;
  const ref = minorContext ? 9 : 0;
  return (((pc - ref) % 12) + 12) % 12;
}

/** Resolve a preset's chords into a target key tonic. */
export function resolvePresetChords(p: ChordProgressionPreset, tonic: string): string[] {
  const off = tonicOffset(tonic, p.minorContext);
  const d = off > 6 ? off - 12 : off;
  return transposeLibraryChords(p.chordsInC, d);
}

export const CHORD_PROGRESSIONS: ChordProgressionPreset[] = [
  { id: "emotional-i-vi-iii-vii", name: "Emotional Descent", category: "emotional", roman: "i – VI – III – VII", chordsInC: ["Am", "F", "C", "G"], minorContext: true, moodTags: ["Emotional", "Melancholic", "Hopeful"], difficulty: "easy", bars: 4, description: "The classic emotional pop loop. Gentle fall then lift.", energy: 5 },
  { id: "emotional-vi-iv-i-v", name: "Sensitive Pop", category: "pop", roman: "vi – IV – I – V", chordsInC: ["Am", "F", "C", "G"], minorContext: false, moodTags: ["Emotional", "Uplifting"], difficulty: "easy", bars: 4, description: "Ubiquitous pop loop; works for ballads and anthems.", energy: 6 },
  { id: "emotional-i-v-vi-iv", name: "Hopeful Rise", category: "uplifting", roman: "i – v – VI – IV", chordsInC: ["Am", "Em", "F", "G"], minorContext: true, moodTags: ["Hopeful", "Uplifting"], difficulty: "easy", bars: 4, description: "Minor lift with a hopeful turnaround.", energy: 6 },
  { id: "cinematic-i-v-vi-iv-big", name: "Cinematic Swell", category: "cinematic", roman: "i – V – VI – IV", chordsInC: ["Am", "E", "F", "G"], minorContext: true, moodTags: ["Cinematic", "Powerful"], difficulty: "medium", bars: 4, description: "Harmonic-major lift on the V; trailer-ready.", energy: 8 },
  { id: "cinematic-vi-iii-vii-iv", name: "Wide Sky", category: "cinematic", roman: "VI – III – VII – IV", chordsInC: ["F", "C", "G", "Bb"], minorContext: true, moodTags: ["Cinematic", "Hopeful", "Dreamy"], difficulty: "easy", bars: 4, description: "Plagal drift, great under strings and pads.", energy: 5 },
  { id: "cinematic-i-bII", name: "Neapolitan Shadow", category: "cinematic", roman: "i – ♭II – i", chordsInC: ["Am", "Bb", "Am", "E"], minorContext: true, moodTags: ["Cinematic", "Mysterious", "Tense"], difficulty: "advanced", bars: 4, description: "Neapolitan colour for film-noir tension.", energy: 4 },
  { id: "dark-i-bVI-bVII", name: "Dark March", category: "dark", roman: "i – ♭VI – ♭VII", chordsInC: ["Am", "F", "G"], minorContext: true, moodTags: ["Dark", "Powerful", "Aggressive"], difficulty: "easy", bars: 3, description: "Phrygian-tinged rock/metal staple.", energy: 8 },
  { id: "dark-i-bVII-bVI-bVII", name: "Undertow", category: "dark", roman: "i – ♭VII – ♭VI – ♭VII", chordsInC: ["Am", "G", "F", "G"], minorContext: true, moodTags: ["Dark", "Tense", "Mysterious"], difficulty: "easy", bars: 4, description: "Hypnotic minor loop for dark pop and trap.", energy: 6 },
  { id: "dark-i-iv-i-v", name: "Nocturne", category: "dark", roman: "i – iv – i – V", chordsInC: ["Am", "Dm", "Am", "E"], minorContext: true, moodTags: ["Dark", "Mysterious", "Melancholic"], difficulty: "medium", bars: 4, description: "Classical minor pull with dominant resolution.", energy: 4 },
  { id: "uplifting-I-V-vi-IV", name: "Anthem", category: "uplifting", roman: "I – V – vi – IV", chordsInC: ["C", "G", "Am", "F"], minorContext: false, moodTags: ["Uplifting", "Powerful", "Euphoric"], difficulty: "easy", bars: 4, description: "The stadium anthem loop.", energy: 9 },
  { id: "uplifting-I-vi-IV-V", name: "Golden Hour", category: "uplifting", roman: "I – vi – IV – V", chordsInC: ["C", "Am", "F", "G"], minorContext: false, moodTags: ["Hopeful", "Uplifting", "Peaceful"], difficulty: "easy", bars: 4, description: "Doo-wop DNA, endlessly singable.", energy: 6 },
  { id: "uplifting-IV-I-V-vi", name: "Daybreak Resolve", category: "resolution", roman: "IV – I – V – vi", chordsInC: ["F", "C", "G", "Am"], minorContext: false, moodTags: ["Hopeful", "Peaceful", "Uplifting"], difficulty: "easy", bars: 4, description: "Starts resolved; deceptive cadence keeps it moving.", energy: 6 },
  { id: "pop-I-vi-IV-V-atex", name: "Pop Standard", category: "pop", roman: "I – vi – ii – V", chordsInC: ["C", "Am", "Dm", "G"], minorContext: false, moodTags: ["Energetic", "Hopeful"], difficulty: "easy", bars: 4, description: "Jazz-pop turnaround, rhythm-changes cousin.", energy: 6 },
  { id: "pop-ii-V-I-vi", name: "Turnaround", category: "pop", roman: "ii – V – I – vi", chordsInC: ["Dm", "G", "C", "Am"], minorContext: false, moodTags: ["Energetic", "Peaceful"], difficulty: "medium", bars: 4, description: "Classic turnaround for verses.", energy: 5 },
  { id: "pop-vi-V-IV-V", name: "Neon Drive", category: "pop", roman: "vi – V – IV – V", chordsInC: ["Am", "G", "F", "G"], minorContext: false, moodTags: ["Energetic", "Dreamy"], difficulty: "easy", bars: 4, description: "Synth-pop cruiser.", energy: 7 },
  { id: "dramatic-i-VI-iv-V", name: "Crown Weight", category: "dramatic", roman: "i – VI – iv – V", chordsInC: ["Am", "F", "Dm", "E"], minorContext: true, moodTags: ["Dramatic", "Tense", "Powerful"], difficulty: "medium", bars: 4, description: "Minor drama with dominant sting.", energy: 8 },
  { id: "dramatic-viidim-I", name: "Overture Lift", category: "dramatic", roman: "vii° – I", chordsInC: ["Bdim", "C", "F", "G"], minorContext: false, moodTags: ["Dramatic", "Cinematic"], difficulty: "advanced", bars: 4, description: "Leading-tone drama into a wide chorus.", energy: 7 },
  { id: "tension-ii-vi-III", name: "Slow Coil", category: "tension", roman: "ii – vi – III", chordsInC: ["Dm", "Am", "C", "Bdim"], minorContext: true, moodTags: ["Tense", "Mysterious"], difficulty: "medium", bars: 4, description: "Unresolved cycling for verses and bridges.", energy: 4 },
  { id: "tension-i-i-bII-i", name: "Tight Wire", category: "tension", roman: "i – i – ♭II – i", chordsInC: ["Am", "Am", "Bb", "Am"], minorContext: true, moodTags: ["Tense", "Aggressive", "Dark"], difficulty: "medium", bars: 4, description: "Pedal tone with phrygian rub.", energy: 7 },
  { id: "resolution-IV-V-I", name: "Homecoming", category: "resolution", roman: "IV – V – I", chordsInC: ["F", "G", "C"], minorContext: false, moodTags: ["Peaceful", "Hopeful", "Resolution"], difficulty: "easy", bars: 3, description: "Pure authentic resolution for outros.", energy: 4 },
  { id: "resolution-vi-IV-I-V", name: "Soft Landing", category: "resolution", roman: "vi – IV – I – V", chordsInC: ["Am", "F", "C", "G"], minorContext: false, moodTags: ["Peaceful", "Emotional"], difficulty: "easy", bars: 4, description: "Gentle loop that always lands.", energy: 4 },
  { id: "dreamy-I-iii-IV-V", name: "Haze", category: "dreamy", roman: "I – iii – IV – V", chordsInC: ["C", "Em", "F", "G"], minorContext: false, moodTags: ["Dreamy", "Peaceful"], difficulty: "easy", bars: 4, description: "Medial drift for dream pop.", energy: 4 },
  { id: "dreamy-vi-IV-I-V-air", name: "Cloud Loop", category: "dreamy", roman: "vi – IV – I – V", chordsInC: ["Am", "F", "C", "G"], minorContext: true, moodTags: ["Dreamy", "Euphoric"], difficulty: "easy", bars: 4, description: "Airy variant with add9 voicings.", energy: 5 },
  { id: "dreamy-I-V-iii-vi", name: "Drift", category: "dreamy", roman: "I – V – iii – vi", chordsInC: ["C", "G", "Em", "Am"], minorContext: false, moodTags: ["Dreamy", "Melancholic"], difficulty: "easy", bars: 4, description: "Descending thirds, weightless.", energy: 4 },
  { id: "powerful-i-bVII-i-VI", name: "Iron Pulse", category: "powerful", roman: "i – ♭VII – i – VI", chordsInC: ["Am", "G", "Am", "F"], minorContext: true, moodTags: ["Powerful", "Aggressive", "Energetic"], difficulty: "easy", bars: 4, description: "Arena-rock minor punch.", energy: 9 },
  { id: "powerful-I-bVII-IV", name: "Stadium Mix", category: "powerful", roman: "I – ♭VII – IV", chordsInC: ["C", "Bb", "F", "G"], minorContext: false, moodTags: ["Powerful", "Euphoric", "Energetic"], difficulty: "easy", bars: 4, description: "Mixolydian swagger for big choruses.", energy: 9 },
  { id: "powerful-vi-bVII-I", name: "Lift Off", category: "powerful", roman: "vi – ♭VII – I", chordsInC: ["Am", "G", "C", "F"], minorContext: false, moodTags: ["Powerful", "Uplifting"], difficulty: "easy", bars: 4, description: "Backward-leaning lift into chorus.", energy: 8 },
  { id: "emotional-i-iv-VI-V", name: "Ache", category: "emotional", roman: "i – iv – VI – V", chordsInC: ["Am", "Dm", "F", "E"], minorContext: true, moodTags: ["Emotional", "Melancholic", "Dramatic"], difficulty: "medium", bars: 4, description: "Baroque-leaning ache.", energy: 5 },
  { id: "emotional-vi-ii-V-I", name: "Confession", category: "emotional", roman: "vi – ii – V – I", chordsInC: ["Am", "Dm", "G", "C"], minorContext: false, moodTags: ["Emotional", "Peaceful"], difficulty: "medium", bars: 4, description: "Full circle for piano ballads.", energy: 4 },
  { id: "cinematic-i-iv-bVII-bIII", name: "Expanse", category: "cinematic", roman: "i – iv – ♭VII – ♭III", chordsInC: ["Am", "Dm", "G", "C"], minorContext: true, moodTags: ["Cinematic", "Mysterious"], difficulty: "medium", bars: 4, description: "Modal interchange for wide shots.", energy: 5 },
  { id: "dark-v-i-v-i", name: "Ritual", category: "dark", roman: "v – i – v – i", chordsInC: ["Em", "Am", "Em", "Am"], minorContext: true, moodTags: ["Dark", "Tense", "Aggressive"], difficulty: "easy", bars: 4, description: "Hypnotic two-chord ritual.", energy: 7 },
  { id: "tension-V-pedal", name: "Pressure Build", category: "tension", roman: "V – V – IV – V", chordsInC: ["G", "G", "F", "G"], minorContext: false, moodTags: ["Tense", "Energetic"], difficulty: "easy", bars: 4, description: "Dominant pedal for pre-chorus lifts.", energy: 7 },
  { id: "dreamy-iv-I-V-vi", name: "Violet Hour", category: "dreamy", roman: "iv – I – V – vi", chordsInC: ["Dm", "C", "G", "Am"], minorContext: false, moodTags: ["Dreamy", "Melancholic", "Peaceful"], difficulty: "easy", bars: 4, description: "Borrowed iv for bittersweet glow.", energy: 4 },
  { id: "pop-I-V-IV-IV", name: "Direct Current", category: "pop", roman: "I – V – IV – IV", chordsInC: ["C", "G", "F", "F"], minorContext: false, moodTags: ["Energetic", "Euphoric"], difficulty: "easy", bars: 4, description: "Modern pop economy.", energy: 8 },
  { id: "dramatic-bVI-bVII-I", name: "Coronation", category: "dramatic", roman: "♭VI – ♭VII – I", chordsInC: ["Ab", "Bb", "C"], minorContext: false, moodTags: ["Dramatic", "Powerful", "Cinematic"], difficulty: "medium", bars: 3, description: "Mario-cadence triumph.", energy: 9 },
  { id: "emotional-i-bIII-iv-VI", name: "Letter Unsent", category: "emotional", roman: "i – ♭III – iv – VI", chordsInC: ["Am", "C", "Dm", "F"], minorContext: true, moodTags: ["Emotional", "Melancholic"], difficulty: "easy", bars: 4, description: "Stepwise minor narrative.", energy: 4 },
  { id: "cinematic-ii-iii-I", name: "First Light", category: "cinematic", roman: "ii – iii – I", chordsInC: ["Dm", "Em", "C", "G"], minorContext: false, moodTags: ["Cinematic", "Hopeful"], difficulty: "easy", bars: 4, description: "Ascending hope.", energy: 5 },
  { id: "powerful-i-VI-III-VII-8", name: "Eight-Bar Epic", category: "powerful", roman: "i – VI – III – VII – i – VI – VII – VII", chordsInC: ["Am", "F", "C", "G", "Am", "F", "G", "G"], minorContext: true, moodTags: ["Powerful", "Cinematic", "Euphoric"], difficulty: "medium", bars: 8, description: "Extended epic loop for final choruses.", energy: 9 },
  { id: "ambient-i-iii-i-VI", name: "Still Water", category: "dreamy", roman: "i – iii – i – VI", chordsInC: ["Am", "C", "Am", "F"], minorContext: true, moodTags: ["Peaceful", "Dreamy", "Mysterious"], difficulty: "easy", bars: 4, description: "Minimal ambient meditation.", energy: 2 },
  { id: "trap-i-VI-i-VI", name: "Night Crawl", category: "dark", roman: "i – VI – i – VI", chordsInC: ["Am", "F", "Am", "F"], minorContext: true, moodTags: ["Dark", "Tense", "Mysterious"], difficulty: "easy", bars: 4, description: "Two-chord trap menace.", energy: 6 },
];

export const PROGRESSION_CATEGORIES = [
  "emotional", "cinematic", "dark", "uplifting", "pop",
  "dramatic", "tension", "resolution", "dreamy", "powerful",
] as const;
