// Tutorial definitions, video metadata, and WebVTT transcript data.

export interface TutorialChapter {
  id: string;
  chapterNumber: number;
  title: string;
  subtitle: string;
  startTime: number; // in seconds
  endTime: number; // in seconds
  targetSelector: string; // e.g. '#panel-chords'
  presetId?: string;
  presetLabel?: string;
  presetDescription?: string;
  keyTakeaway: string;
  callout?: {
    x: number;
    y: number;
    zoom: number;
    label: string;
  };
}

export interface TutorialVideoMeta {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  src: string;
  fallbackSrc?: string;
  duration: number; // 420.0s
  aspectRatio: "16:9" | "9:16";
  vttSrc: string;
  chapters: TutorialChapter[];
}

export const PC_TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: "pc-ch1-overview",
    chapterNumber: 1,
    title: "Studio Workspace Overview",
    subtitle: "Project Initialization & Interface Tour",
    startTime: 0,
    endTime: 25,
    targetSelector: "#panel-overview",
    keyTakeaway: "Zero-install digital audio workstation running 100% in your browser.",
    callout: { x: 960, y: 150, zoom: 1.2, label: "Top Transport & Status" },
  },
  {
    id: "pc-ch2-chords",
    chapterNumber: 2,
    title: "Chord Progression & Voicings",
    subtitle: "Modal Scales & Drop-2 Harmony",
    startTime: 25,
    endTime: 85,
    targetSelector: "#panel-chords",
    presetId: "tutorial-neo-soul-9th",
    presetLabel: "Neo-Soul 9th Chords",
    presetDescription: "E♭ Dorian 9th chords with drop-2 jazz voicing.",
    keyTakeaway: "Drop-2 voicing opens up closed triads into rich studio harmonies.",
    callout: { x: 500, y: 350, zoom: 1.8, label: "Chord Voicing Selector" },
  },
  {
    id: "pc-ch3-drums",
    chapterNumber: 3,
    title: "Drum Sequencer & Polyrhythms",
    subtitle: "Poly-meter Grid & Velocity Accents",
    startTime: 85,
    endTime: 145,
    targetSelector: "#panel-drums",
    presetId: "tutorial-polyrhythm-grid",
    presetLabel: "Polyrhythmic Percussion Grid",
    presetDescription: "16-step grid combining 4-on-the-floor kick, 3-step perc, and 5-step clap.",
    keyTakeaway: "Independent row cycle lengths create evolving polyrhythmic motion.",
    callout: { x: 500, y: 580, zoom: 1.9, label: "Polyrhythm Row Steps" },
  },
  {
    id: "pc-ch4-bass",
    chapterNumber: 4,
    title: "Basslines & Arpeggiator",
    subtitle: "Root/Octave Rhythms & 1/16 Syncopation",
    startTime: 145,
    endTime: 265,
    targetSelector: "#panel-bass",
    presetId: "tutorial-neon-arp",
    presetLabel: "Neon Bassline & Arp",
    presetDescription: "Synchronized arpeggiator with 1/16 up-down pattern and analog warmth.",
    keyTakeaway: "Harmonically locked basslines anchor progressions and dynamic energy.",
    callout: { x: 500, y: 480, zoom: 1.8, label: "Pattern Arpeggiator Modes" },
  },
  {
    id: "pc-ch5-mixer",
    chapterNumber: 5,
    title: "Instrument Mixer & Multisample Banks",
    subtitle: "Acoustic Realism & Synthesis Layering",
    startTime: 265,
    endTime: 305,
    targetSelector: "#panel-mixer",
    keyTakeaway: "Multisampled instrument velocity layers blend realism with synth textures.",
    callout: { x: 500, y: 620, zoom: 1.7, label: "Multisample Engine" },
  },
  {
    id: "pc-ch6-structure",
    chapterNumber: 6,
    title: "Song Arrangement Timeline",
    subtitle: "Dynamic Energy Curves & Section Scaffolding",
    startTime: 305,
    endTime: 375,
    targetSelector: "#panel-structure",
    presetId: "tutorial-5part-arrangement",
    presetLabel: "5-Part Arrangement Arc",
    presetDescription: "Full dynamic song structure spanning Intro to Outro with 3-10 energy escalation.",
    keyTakeaway: "Arrangement energy sliders automate per-section intensity and arrangement density.",
    callout: { x: 500, y: 400, zoom: 1.6, label: "Energy Curves" },
  },
  {
    id: "pc-ch7-effects",
    chapterNumber: 7,
    title: "Master DSP FX & Export Pipeline",
    subtitle: "Compressor Sidechain, Convolver & Lossless Audio",
    startTime: 375,
    endTime: 420,
    targetSelector: "#panel-effects",
    presetId: "tutorial-orchestral-stack",
    presetLabel: "Orchestral Hall & Sidechain FX",
    presetDescription: "Studio reverb hall with 4:1 compression and 3-band parametric EQ.",
    keyTakeaway: "Hardware-modeled DSP effects provide professional master bus sheen and punch.",
    callout: { x: 500, y: 520, zoom: 1.8, label: "Sidechain Compressor" },
  },
];

export const PHONE_TUTORIAL_CHAPTERS: TutorialChapter[] = [
  {
    id: "phone-ch1-overview",
    chapterNumber: 1,
    title: "Mobile Studio & Touch Ergonomics",
    subtitle: "Touch-First Navigation & Viewports",
    startTime: 0,
    endTime: 30,
    targetSelector: "#panel-overview",
    keyTakeaway: "Full DAW capabilities optimized for thumb-reach mobile gestures.",
  },
  {
    id: "phone-ch2-chords",
    chapterNumber: 2,
    title: "Touch Chord Pad Matrix",
    subtitle: "Modal Voicing & Tap-to-Preview",
    startTime: 30,
    endTime: 90,
    targetSelector: "#panel-chords",
    presetId: "tutorial-neo-soul-9th",
    presetLabel: "Neo-Soul 9th Chords",
    presetDescription: "E♭ Dorian 9th chords with drop-2 jazz voicing.",
    keyTakeaway: "Tap chord chips to audition voicings directly from mobile.",
  },
  {
    id: "phone-ch3-drums",
    chapterNumber: 3,
    title: "Touch Drum Sequencer",
    subtitle: "Mobile Step Sequencing & Accents",
    startTime: 90,
    endTime: 160,
    targetSelector: "#panel-drums",
    presetId: "tutorial-polyrhythm-grid",
    presetLabel: "Polyrhythmic Percussion Grid",
    presetDescription: "16-step grid combining 4-on-the-floor kick, 3-step perc, and 5-step clap.",
    keyTakeaway: "Swipe and tap grid cells with high-precision touch triggers.",
  },
  {
    id: "phone-ch4-mixer",
    chapterNumber: 4,
    title: "Mobile Quick Drawer Mixer & FX",
    subtitle: "Bottom Drawer Ergonomics & DSP",
    startTime: 160,
    endTime: 250,
    targetSelector: "#panel-mixer",
    keyTakeaway: "Slide-up bottom drawer gives instant access to mixer volume and DSP effects.",
  },
  {
    id: "phone-ch5-bass",
    chapterNumber: 5,
    title: "Mobile Bass & Arpeggiator",
    subtitle: "Thumb-Accessible Pattern Tuning",
    startTime: 250,
    endTime: 315,
    targetSelector: "#panel-bass",
    presetId: "tutorial-neon-arp",
    presetLabel: "Neon Bassline & Arp",
    presetDescription: "Synchronized arpeggiator with 1/16 up-down pattern and analog warmth.",
    keyTakeaway: "Configure bassline style and arpeggiation rate on compact screens.",
  },
  {
    id: "phone-ch6-structure",
    chapterNumber: 6,
    title: "Touch Arrangement Blocks",
    subtitle: "Section Duplication & Energy Scaling",
    startTime: 315,
    endTime: 370,
    targetSelector: "#panel-structure",
    presetId: "tutorial-5part-arrangement",
    presetLabel: "5-Part Arrangement Arc",
    presetDescription: "Full dynamic song structure spanning Intro to Outro with 3-10 energy escalation.",
    keyTakeaway: "Organize intro, verse, and chorus blocks seamlessly on mobile devices.",
  },
  {
    id: "phone-ch7-effects",
    chapterNumber: 7,
    title: "Mobile Export & URL Sharing",
    subtitle: "Lossless Audio & Compressed Project URLs",
    startTime: 370,
    endTime: 420,
    targetSelector: "#panel-effects",
    presetId: "tutorial-orchestral-stack",
    presetLabel: "Orchestral Hall & Sidechain FX",
    presetDescription: "Studio reverb hall with 4:1 compression and 3-band parametric EQ.",
    keyTakeaway: "Export 16-bit WAV audio or share GZIP-compressed project URLs instantly.",
  },
];

export const TUTORIAL_VIDEOS: Record<"pc" | "phone", TutorialVideoMeta> = {
  pc: {
    id: "pc-tutorial",
    title: "SonicBlueprint Studio Masterclass (Desktop)",
    subtitle: "Complete Digital Audio Workstation Tutorial",
    description:
      "A comprehensive 7-minute masterclass covering chord voicing algebra, polyrhythmic drum sequencing, basslines, multi-sample layering, arrangement structure, and master DSP effects.",
    src: "/tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4",
    fallbackSrc: "https://storage.googleapis.com/sonicblueprint-assets/tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4",
    duration: 420.0,
    aspectRatio: "16:9",
    vttSrc: "/tutorials/pc-tutorial.en.vtt",
    chapters: PC_TUTORIAL_CHAPTERS,
  },
  phone: {
    id: "phone-tutorial",
    title: "SonicBlueprint Mobile DAW Walkthrough (Touch)",
    subtitle: "Touch-First Music Production on Mobile",
    description:
      "Master music production on touch devices. Learn touch pad performance, mobile bottom drawer controls, gesture-based sequencing, and instant URL sharing.",
    src: "/tutorials/SonicBlueprint-Phone-Tutorial-REVIEW.mp4",
    fallbackSrc: "https://storage.googleapis.com/sonicblueprint-assets/tutorials/SonicBlueprint-Phone-Tutorial-REVIEW.mp4",
    duration: 420.0,
    aspectRatio: "9:16",
    vttSrc: "/tutorials/phone-tutorial.en.vtt",
    chapters: PHONE_TUTORIAL_CHAPTERS,
  },
};

export const PC_TUTORIAL_VTT = `WEBVTT - SonicBlueprint Desktop Studio Masterclass
Kind: captions
Language: en

00:00:00.000 --> 00:00:05.000
Welcome to SonicBlueprint, your professional in-browser digital audio workstation.

00:00:05.000 --> 00:00:12.000
SonicBlueprint runs entirely in your web browser with zero latency, zero installation, and complete offline capability.

00:00:12.000 --> 00:00:19.000
The top transport bar controls song playback, master tempo BPM, musical key tonic, and real-time audio synchronization.

00:00:19.000 --> 00:00:25.000
Notice the mix layer toggles: you can independently isolate or mute chords, drums, bass, and melody lines in real time.

00:00:25.000 --> 00:00:33.000
Now let's explore harmonic design in the Chord Editor. Choose from classical, modal, and extended jazz progressions.

00:00:33.000 --> 00:00:42.000
Here in E flat Dorian, our progression cycles through E flat minor 9, D flat major 9, C minor 9, and F minor 9.

00:00:42.000 --> 00:00:52.000
Using the Voicing selector, switch between Root position, First Inversion, Drop-2, and Open Spread voicings.

00:00:52.000 --> 00:01:05.000
Drop-2 voicings drop the second voice from the top down an octave, creating wide, open spacing favored by neo-soul and jazz arrangers.

00:01:05.000 --> 00:01:15.000
Click any chord chip to preview its harmonic sound. The visual piano and fretboard below display the active notes across registers.

00:01:15.000 --> 00:01:25.000
Tap Tempo lets you dial in natural tempos by tapping in rhythm. You can also drag the BPM slider smoothly without audio glitches.

00:01:25.000 --> 00:01:35.000
Moving down to the Drum Sequencer, we find an advanced poly-meter and polyrhythmic step grid.

00:01:35.000 --> 00:01:45.000
Each drum row—Kick, Snare, Hi-Hat, Percussion, and Clap—can operate on its own independent loop cycle length.

00:01:45.000 --> 00:01:58.000
For example, pairing a 4-step kick with a 3-step percussion and a 5-step clap yields a polyrhythm that naturally evolves across measures.

00:01:58.000 --> 00:02:12.000
The velocity accent row lets you punch individual steps with a twenty-five percent gain boost, injecting dynamic groove and swing.

00:02:12.000 --> 00:02:25.000
Adjust the Swing slider to apply subtle swing or aggressive shuffle feel to sixteenth notes without losing tempo sync.

00:02:25.000 --> 00:02:35.000
Next, let's shape our low-end foundation in the Bass and Arpeggiator panel.

00:02:35.000 --> 00:02:48.000
Choose between acoustic upright, modern electric, analog synth, or deep sub bass styles, each matched with specialized harmonic synthesis.

00:02:48.000 --> 00:03:05.000
The pattern arpeggiator transforms chord tones into rhythmic melodic motion. Select Up, Down, Up-Down, or As-Played patterns.

00:03:05.000 --> 00:03:25.000
Rate settings from quarter notes to sixteenth-note triplets sync flawlessly with the global transport clock.

00:03:25.000 --> 00:03:45.000
Notice how the bassline stays locked to the harmonic roots of your chords while the arpeggiator weaves melodic energy above it.

00:03:45.000 --> 00:04:05.000
You can adjust the octave register and volume balance to keep your bass sitting squarely in the pocket of the mix.

00:04:05.000 --> 00:04:25.000
Every tweak takes effect immediately during playback, allowing you to fine-tune your arrangement live.

00:04:25.000 --> 00:04:35.000
In the Instrument Mixer, you have complete control over multisampled instruments and virtual synthesis.

00:04:35.000 --> 00:04:45.000
Layer acoustic grand piano with warm analog pads, nylon guitar, solo cello, and string ensembles.

00:04:45.000 --> 00:04:55.000
Adjust per-instrument volume, stereo pan position, and register octave to build a spacious, balanced stereo field.

00:04:55.000 --> 00:05:05.000
Our multisample engine switches seamlessly between velocity layers for expressive acoustic dynamics.

00:05:05.000 --> 00:05:15.000
Now let's build a complete song in the Arrangement Timeline.

00:05:15.000 --> 00:05:25.000
Structure your track with Intro, Verse, Pre-Chorus, Chorus, Bridge, and Outro sections.

00:05:25.000 --> 00:05:35.000
Each section features a dedicated Energy slider from one to ten, which automatically automates arrangement density.

00:05:35.000 --> 00:05:50.000
Lower energy sections thin out instruments and soften drums, while high energy choruses trigger full instrumentation and accented beats.

00:05:50.000 --> 00:06:05.000
Reorder sections easily, duplicate verses, or click any section to start playback directly from that measure.

00:06:05.000 --> 00:06:15.000
Finally, let's polish our track with Master DSP Effects.

00:06:15.000 --> 00:06:25.000
Engage the hardware-modeled Bus Compressor with adjustable threshold, four-to-one ratio, and smooth sidechain ducking.

00:06:25.000 --> 00:06:35.000
Add depth with the Convolution Reverb hall algorithm, and space with tempo-synced Stereo Delay.

00:06:35.000 --> 00:06:45.000
When your track is ready, export lossless 16-bit 44.1kHz WAV, high-bitrate MP3 with ID3 tags, isolated stem archives, or shareable project URLs.

00:06:45.000 --> 00:07:00.000
Thank you for watching the SonicBlueprint Masterclass. Click 'Try in Studio' to load these project presets and start creating music now!
`;

export const PHONE_TUTORIAL_VTT = `WEBVTT - SonicBlueprint Mobile DAW Walkthrough
Kind: captions
Language: en

00:00:00.000 --> 00:00:06.000
Welcome to SonicBlueprint on mobile, a complete touch-first digital audio workstation in your pocket.

00:00:06.000 --> 00:00:15.000
Every feature has been optimized for touch ergonomics with 48-pixel minimum touch targets and safe-area padding.

00:00:15.000 --> 00:00:30.000
Use the bottom navigation dock to switch between Dashboard, Projects, Presets, and this Tutorial Hub with one tap.

00:00:30.000 --> 00:00:45.000
In the mobile Chord Editor, tap any chord pad to audition it instantly. Swipe horizontally to view extended voicings.

00:00:45.000 --> 00:01:05.000
Select your tonic and scale modal tuning with thumb-friendly selectors designed for fast performance on mobile screens.

00:01:05.000 --> 00:01:30.000
Switch to Drop-2 voicings to hear lush jazz voicings tailored for small-speaker stereo imaging.

00:01:30.000 --> 00:01:50.000
The mobile Drum Sequencer features large, responsive trigger pads. Tap steps to build your groove effortlessly.

00:01:50.000 --> 00:02:15.000
Engage accent mode to emphasize downbeats with a single touch, giving your beats instant bounce and groove.

00:02:15.000 --> 00:02:40.000
Adjust the swing slider with smooth touch drag physics for humanized pocket timing.

00:02:40.000 --> 00:03:10.000
Swipe up the Mobile Bottom Drawer anytime during playback to adjust mixer volume and master effects on the fly.

00:03:10.000 --> 00:03:40.000
The drawer slides smoothly without interrupting audio, letting you mix levels and toggle master reverb anywhere.

00:03:40.000 --> 00:04:10.000
In the Bass and Arp panel, tune your bassline style and choose from sixteen arpeggiation rhythms.

00:04:10.000 --> 00:04:40.000
Hear how the arpeggiator rhythmically animates your chord tones while maintaining rock-solid low-end sync.

00:04:40.000 --> 00:05:15.000
Arrange full songs using touch cards. Adjust section energy from one to ten with responsive thumb sliders.

00:05:15.000 --> 00:05:40.000
Tap any section to jump playback instantly to that marker, ideal for live performance and quick arrangement testing.

00:05:40.000 --> 00:06:10.000
Finally, export your masterpiece as 16-bit lossless WAV, standard MIDI file, or copy a GZIP-compressed project URL.

00:06:10.000 --> 00:06:35.000
Send your project link to any collaborator—they can open it in any browser with zero backend account required.

00:06:35.000 --> 00:07:00.000
SonicBlueprint Mobile DAW puts pro music production in your pocket. Tap 'Try in Studio' below to start making music today!
`;
