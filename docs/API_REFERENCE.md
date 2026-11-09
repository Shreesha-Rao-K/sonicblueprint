# SonicBlueprint API & Interface Reference

## 1. Core Data Models & TypeScript Interfaces

### Musical Structure & Song Hierarchy

```typescript
export interface Song {
  id: string;
  title: string;
  tempo: number; // BPM (40 - 240)
  key: string; // e.g. "C", "F#", "Eb"
  scale: "major" | "minor" | "dorian" | "mixolydian" | "pentatonic";
  timeSignature: [number, number]; // e.g. [4, 4] or [3, 4]
  swing: number; // 0.0 to 1.0 (groove percentage)
  sections: Section[];
  tracks: Track[];
  masterEffects: MasterEffectsConfig;
  createdAt: number;
  updatedAt: number;
  version: number;
}

export interface Section {
  id: string;
  name: string; // "Intro", "Verse", "Chorus", "Bridge", "Outro"
  bars: number; // 1 to 32
  energy: number; // 1 to 10 (controls arrangement density)
  chordProgressionId?: string;
  chords: Chord[];
}

export interface Chord {
  id: string;
  root: string; // "C", "D", "Eb", etc.
  quality: "maj" | "min" | "dim" | "aug" | "7" | "maj7" | "min7" | "9" | "sus4";
  roman: string; // "I", "ii", "IV", "V7", etc.
  durationBars: number; // usually 1 or 2
  voicing: ChordVoicing;
}

export interface ChordVoicing {
  type: "root" | "inversion1" | "inversion2" | "drop2" | "open";
  midiNotes: number[]; // e.g. [60, 64, 67, 71]
  octaveOffset: number;
}
```

### Drum Sequencer & Grid Data

```typescript
export interface DrumPattern {
  id: string;
  name: string;
  category: "hiphop" | "house" | "trap" | "rock" | "ambient" | "latin";
  steps: number; // 16 or 32
  tracks: DrumTrack[];
}

export interface DrumTrack {
  voiceId: "kick" | "snare" | "clap" | "closedHat" | "openHat" | "tomLow" | "tomHigh" | "shaker";
  steps: boolean[]; // Array of length `steps`, true = active
  velocities?: number[]; // 0.0 to 1.0
  probability?: number[]; // 0.0 to 1.0 (generative probability)
}
```

### Master Effects Configuration

```typescript
export interface MasterEffectsConfig {
  eq: {
    enabled: boolean;
    lowGain: number; // -12 to +12 dB (100 Hz shelf)
    midGain: number; // -12 to +12 dB (1 kHz peak)
    highGain: number; // -12 to +12 dB (8 kHz shelf)
  };
  compressor: {
    enabled: boolean;
    threshold: number; // -40 to 0 dB
    ratio: number; // 1 to 20
    attack: number; // 0.001 to 0.1s
    release: number; // 0.05 to 1.0s
  };
  delay: {
    enabled: boolean;
    time: number; // seconds or tempo-synced subdivision
    feedback: number; // 0.0 to 0.95
    mix: number; // 0.0 (dry) to 1.0 (wet)
  };
  reverb: {
    enabled: boolean;
    decay: number; // 0.1 to 10s
    mix: number; // 0.0 to 1.0
    impulseId?: string; // "studio-room" | "concert-hall" | "plate"
  };
}
```

---

## 2. Audio Engine API (`src/lib/audio-engine.ts`)

The `AudioEngine` singleton provides direct access to real-time playback and rendering:

```typescript
export class AudioEngine {
  /**
   * Initializes AudioContext with { latencyHint: "interactive" }.
   * Must be called in response to a user gesture.
   */
  async ensure(): Promise<void>;

  /**
   * Begins playback of the loaded song from currentBar.
   */
  play(): void;

  /**
   * Pauses real-time playback preserving playhead position.
   */
  pause(): void;

  /**
   * Stops playback and resets playhead to bar 0.
   */
  stop(): void;

  /**
   * Repositions playback playhead to target bar.
   */
  seek(bar: number): void;

  /**
   * Sets real-time playback tempo in beats per minute.
   */
  setTempo(bpm: number): void;

  /**
   * Updates master bus EQ, compressor, delay, or reverb parameters.
   */
  setEffects(config: Partial<MasterEffectsConfig>): void;

  /**
   * Renders the song to lossless 16-bit stereo PCM WAV via OfflineAudioContext.
   */
  exportWav(song: Song): Promise<Blob>;

  /**
   * Generates a Standard MIDI File (SMF Type 1) blob for DAW import.
   */
  exportMidi(song: Song): Promise<Blob>;
}

export function getEngine(): AudioEngine;
```

---

## 3. Storage & Project Persistence API (`src/lib/db.ts`)

```typescript
/**
 * Saves or updates a project document in IndexedDB.
 */
export async function saveProject(song: Song): Promise<void>;

/**
 * Loads a project by ID from IndexedDB.
 */
export async function loadProject(id: string): Promise<Song | null>;

/**
 * Returns a list of all stored projects sorted by updatedAt descending.
 */
export async function listProjects(): Promise<Array<{ id: string; title: string; updatedAt: number }>>;

/**
 * Deletes a project by ID.
 */
export async function deleteProject(id: string): Promise<void>;

/**
 * Serializes project to JSON with schema versioning.
 */
export function exportProjectJson(song: Song): string;

/**
 * Validates, sanitizes, and parses an imported JSON string into a valid Song.
 */
export function importProjectJson(json: string): Song;
```

---

## 4. Accessibility Announcer API (`src/lib/a11y-announcer.ts`)

```typescript
export type AnnouncePriority = "polite" | "assertive";

/**
 * Dispatches an accessible vocal announcement to assistive technology.
 */
export function announce(message: string, priority?: AnnouncePriority): void;

/**
 * Subscribes a listener callback to live announcement dispatches.
 */
export function subscribeAnnouncer(listener: (message: string, priority: AnnouncePriority) => void): () => void;

/**
 * Announces transport status updates (play, pause, stop).
 */
export function announceTransport(state: "playing" | "paused" | "stopped", tempo: number): void;

/**
 * Announces debounced tempo adjustments.
 */
export function announceTempo(bpm: number): void;

/**
 * Announces preset selection and hydration.
 */
export function announcePreset(name: string, type: "chord" | "drum" | "template"): void;

/**
 * Announces drum grid step pad toggling.
 */
export function announceSequencer(voiceName: string, step: number, active: boolean): void;
```

---

## 5. UI Component Contracts & Props

### `DrumSequencer`
```typescript
interface DrumSequencerProps {
  pattern: DrumPattern;
  currentStep?: number;
  onToggleStep: (voiceId: string, stepIndex: number) => void;
  onSelectPreset?: (presetId: string) => void;
}
```

### `TactileKnob`
```typescript
interface TactileKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}
```

### `KeyboardShortcutsModal`
```typescript
interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```
