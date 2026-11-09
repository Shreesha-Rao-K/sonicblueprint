// Complete 420.0s narration scripts and chapter metadata for studio voiceover synthesis.

export interface TutorialNarrationChapter {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  durationSeconds: number;
  startTimeSeconds: number;
  targetComponentSelector: string;
  studioPresetId?: string;
  voiceoverScript: string;
}

export const TUTORIAL_NARRATION_CHAPTERS: TutorialNarrationChapter[] = [
  {
    id: "narr-ch1-overview",
    number: 1,
    title: "Welcome & Studio Overview",
    subtitle: "In-Browser DAW Initialization & Navigation",
    durationSeconds: 45,
    startTimeSeconds: 0,
    targetComponentSelector: "#panel-overview",
    studioPresetId: "tutorial-neo-soul-9th",
    voiceoverScript:
      "Welcome to SonicBlueprint, your professional in-browser music studio and digital audio workstation. SonicBlueprint operates completely offline with zero installation and zero cloud latency. The top transport bar controls song playback, master tempo BPM, musical key tonic, and real-time audio synchronization. Notice the mix layer toggles: you can independently isolate or mute chords, drums, bass, and melody lines in real time.",
  },
  {
    id: "narr-ch2-chords",
    number: 2,
    title: "Chord Progression & Voice Leading",
    subtitle: "Modal Voicing Algebra & Harmonic Design",
    durationSeconds: 55,
    startTimeSeconds: 45,
    targetComponentSelector: "#panel-chords",
    studioPresetId: "tutorial-neo-soul-9th",
    voiceoverScript:
      "Now let's explore harmonic design in the Chord Editor. SonicBlueprint features classical, modal, and extended jazz progressions. In E flat Dorian, our progression cycles through E flat minor 9, D flat major 9, C minor 9, and F minor 9. Using the Voicing selector, switch between Root position, First Inversion, Drop-2, and Open Spread voicings. Drop-2 voicings drop the second voice from the top down an octave, creating wide, open spacing favored by neo-soul and jazz arrangers.",
  },
  {
    id: "narr-ch3-fretboard",
    number: 3,
    title: "Fretboard & Voicing Inspector",
    subtitle: "Visual Harmony Preview on Keys and Strings",
    durationSeconds: 55,
    startTimeSeconds: 100,
    targetComponentSelector: "#panel-harmony",
    studioPresetId: "tutorial-neo-soul-9th",
    voiceoverScript:
      "Click any chord chip to preview its harmonic sound. The visual piano and fretboard below display the active notes across registers. Color-coded markers show root, third, fifth, and extended intervals across the CAGED fretboard system. Tap Tempo lets you dial in natural tempos by tapping in rhythm. You can also drag the BPM slider smoothly without audio glitches.",
  },
  {
    id: "narr-ch4-drums",
    number: 4,
    title: "Drum Sequencing & Kinetics",
    subtitle: "Poly-meter Step Grid & Velocity Accents",
    durationSeconds: 55,
    startTimeSeconds: 155,
    targetComponentSelector: "#panel-drums",
    studioPresetId: "tutorial-polyrhythm-grid",
    voiceoverScript:
      "Moving down to the Drum Sequencer, we find an advanced poly-meter and polyrhythmic step grid. Each drum row—Kick, Snare, Hi-Hat, Percussion, and Clap—can operate on its own independent loop cycle length. For example, pairing a 4-step kick with a 3-step percussion and a 5-step clap yields an evolving polyrhythm that breathes across measures. The velocity accent row punches individual steps with a twenty-five percent gain boost for dynamic groove.",
  },
  {
    id: "narr-ch5-bass",
    number: 5,
    title: "Basslines & Arpeggiation",
    subtitle: "Harmonic Lock & 1/16 Syncopated Patterns",
    durationSeconds: 60,
    startTimeSeconds: 210,
    targetComponentSelector: "#panel-bass",
    studioPresetId: "tutorial-neon-arp",
    voiceoverScript:
      "Next, let's shape our low-end foundation in the Bass and Arpeggiator panel. Choose between acoustic upright, modern electric, analog synth, or deep sub bass styles, each matched with specialized harmonic synthesis. The pattern arpeggiator transforms chord tones into rhythmic melodic motion. Rate settings from quarter notes to sixteenth-note triplets sync flawlessly with the global transport clock.",
  },
  {
    id: "narr-ch6-mixer",
    number: 6,
    title: "Mixer & Studio Dynamics FX",
    subtitle: "Multisample Layering & Master Bus Compression",
    durationSeconds: 60,
    startTimeSeconds: 270,
    targetComponentSelector: "#panel-mixer",
    studioPresetId: "tutorial-orchestral-stack",
    voiceoverScript:
      "In the Instrument Mixer, you have complete control over multisampled instruments and virtual synthesis. Layer acoustic grand piano with warm analog pads, nylon guitar, solo cello, and string ensembles. Adjust per-instrument volume, stereo pan position, and register octave. In the Master Effects panel, our hardware-modeled Bus Compressor features sidechain ducking, four-to-one ratio, and smooth release curves.",
  },
  {
    id: "narr-ch7-structure",
    number: 7,
    title: "Song Structure & Arrangement",
    subtitle: "Dynamic Energy Curves & Section Scaffolding",
    durationSeconds: 50,
    startTimeSeconds: 330,
    targetComponentSelector: "#panel-structure",
    studioPresetId: "tutorial-5part-arrangement",
    voiceoverScript:
      "Now let's build a complete song in the Arrangement Timeline. Structure your track with Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro sections. Each section features a dedicated Energy slider from one to ten, which automatically automates arrangement density. Reorder sections easily, duplicate verses, or click any section to start playback directly from that measure.",
  },
  {
    id: "narr-ch8-export",
    number: 8,
    title: "Audio Mastering & Export",
    subtitle: "Lossless Audio, Stems ZIP & Portable URLs",
    durationSeconds: 40,
    startTimeSeconds: 380,
    targetComponentSelector: "#panel-effects",
    studioPresetId: "tutorial-orchestral-stack",
    voiceoverScript:
      "When your track is ready, export broadcast-mastered minus fourteen LUFS lossless sixteen-bit WAV audio, high-bitrate MP3 with ID3 tags, isolated stem ZIP archives, Type 1 MIDI, or printable PDF blueprints. You can also copy a GZIP-compressed project URL to share your entire project with zero backend requirements. Thank you for watching the SonicBlueprint Masterclass!",
  },
];
