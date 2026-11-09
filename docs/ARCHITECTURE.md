# SonicBlueprint System Architecture

## 1. Executive Summary & Topology

SonicBlueprint is a modern, zero-install, browser-native Digital Audio Workstation (DAW) and chord progression composition studio. Built with Next.js 15, React 19, TypeScript, Tailwind CSS, and the Web Audio API, it runs entirely client-side with zero audio streaming latency, zero telemetry, and complete offline capability via Progressive Web App (PWA) architecture.

### System Topology Diagram

```
+---------------------------------------------------------------------------------------+
|                                    Client Browser                                     |
+---------------------------------------------------------------------------------------+
|                                                                                       |
|  +---------------------------------------------------------------------------------+  |
|  |                             Presentation Layer (React 19)                       |  |
|  |  +--------------------+  +--------------------+  +----------------------------+ |  |
|  |  |   TransportBar     |  |    ChordEditor     |  |    8x16 DrumSequencer      | |  |
|  |  +--------------------+  +--------------------+  +----------------------------+ |  |
|  |  | ArrangementTimeline|  | MasterEffectsPanel |  | PianoPreview / Fretboard   | |  |
|  |  +--------------------+  +--------------------+  +----------------------------+ |  |
|  |  | Live A11y Announcer|  | KeyboardShortcuts  |  | TactileKnobs & Sliders     | |  |
|  +--+--------------------+--+--------------------+--+----------------------------+-+  |
|                                         | Action Dispatches                            |
|                                         v                                              |
|  +---------------------------------------------------------------------------------+  |
|  |                          State Management & History                             |  |
|  |  - Immutable Project State Tree (Chords, Voicings, Drum Grid, Timeline, FX)     |  |
|  |  - Undo / Redo Command History Stack                                            |  |
|  |  - Active Transport State (playState, currentBar, tempo, swing, timeSignature) |  |
|  +---------------------------------------------------------------------------------+  |
|             |                                                  |                      |
|             v                                                  v                      |
|  +------------------------------------+  +-----------------------------------------+  |
|  |       Persistence Engine           |  |        Audio Compiler & Scheduler       |  |
|  |  - IndexedDB (sonicblueprint_db)   |  |  - AudioContext (latencyHint: "interact")|  |
|  |  - Schema Migrations v1 -> v2      |  |  - Lookahead Scheduler (35ms lead buffer)|  |
|  |  - JSON Project Export / Import    |  |  - Polyphonic Voice Allocator           |  |
|  +------------------------------------+  +-----------------------------------------+  |
|                                                                |                      |
|                                                                v                      |
|  +---------------------------------------------------------------------------------+  |
|  |                         Web Audio DSP & Synthesis Graph                         |  |
|  |  +------------------+   +-------------------+   +----------------------------+  |  |
|  |  | Dual-Oscillator  |   | Multisample Sound |   | Dynamic Synthesis Voice    |  |  |
|  |  | Subtractive Synth|   | Font Sample Bank  |   | Drum Synthesis (8 Voices)  |  |  |
|  |  +------------------+   +-------------------+   +----------------------------+  |  |
|  |           \                       |                       /                     |  |
|  |            +----------------------+----------------------+                      |  |
|  |                                   |                                             |  |
|  |                                   v                                             |  |
|  |  +---------------------------------------------------------------------------+  |  |
|  |  |                     Master Effects Processing Bus                         |  |  |
|  |  |  +---------------+  +---------------+  +---------------+  +------------+  |  |  |
|  |  |  | 3-Band Param  |->| VCA Sidechain |->| Stereo Chorus |->| Convolver  |  |  |  |
|  |  |  | Equalizer     |  | Compressor    |  | & Ping-Pong DL|  | & Reverb   |  |  |  |
|  |  |  +---------------+  +---------------+  +---------------+  +------------+  |  |  |
|  |  +---------------------------------------------------------------------------+  |  |
|  |                                   |                                             |  |
|  |                                   v                                             |  |
|  |  +---------------------------------------------------------------------------+  |  |
|  |  | Audio Destination (Speakers) / OfflineAudioContext (WAV / MP3 Exporter)   |  |  |
|  |  +---------------------------------------------------------------------------+  |  |
|  +---------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------+
```

---

## 2. Layer Boundaries & Separation of Concerns

SonicBlueprint enforces strict architectural boundaries to guarantee modularity, maintainability, and testability:

1. **Presentation Layer (`src/components/`, `src/app/`)**:
   - Pure UI rendering using React 19 functional components and CSS modules / Tailwind CSS.
   - Code-split below-the-fold heavy modules (`DrumSequencer`, `ArrangementTimeline`, `MasterEffectsPanel`, `InstrumentMixer`) using `next/dynamic` and SSR-free skeleton fallbacks (`PanelSkeletons.tsx`).
   - Zero direct AudioNode manipulation in React views; all user interactions dispatch semantic state changes or transport actions.

2. **State Management (`src/lib/`, React Context & Hooks)**:
   - Centralized project data representation (`Song`, `Track`, `Section`, `Chord`, `DrumPattern`).
   - Pure state transitions guaranteeing immutability, enabling instant serialization and multi-level undo/redo operations.

3. **Audio Compiler & Scheduling Engine (`src/lib/audio-engine.ts`, `src/lib/audio/`)**:
   - Compiles high-level musical constructs (chord names, roman numeral degrees, note durations, drum triggers) into sample-accurate Web Audio clock events.
   - Decoupled from React render cycles; utilizes a high-precision `setInterval` lookahead scheduler that computes events ahead of time and schedules them with `AudioContext.currentTime`.

4. **DSP & Synthesis Engine (`src/lib/synth/`, `src/lib/dsp/`)**:
   - Contains synthesis voice generators (subtractive synth, 808/909 drum models, multisampled acoustic instruments).
   - Manages signal routing, stereo spatialization, filtering, non-linear saturation, dynamics compression, and convolution reverb.

5. **Persistence & Serialization (`src/lib/db.ts`, `src/lib/project-serializer.ts`)**:
   - Encapsulates IndexedDB storage, automated version schema migrations, import sanitization, and export packaging (JSON, WAV, MIDI).

---

## 3. Audio Compiler vs. Audio Graph

A crucial distinction in SonicBlueprint is the separation between the **Audio Compiler** and the **Audio Graph**:

- **The Audio Compiler**:
  - Operates on symbolic, declarative musical representations (e.g., `{ root: "Eb", quality: "m9", voicing: "drop2", duration: "1m" }`).
  - Performs voice leading, root note calculation, frequency transposition via 12-TET math ($f = 440 \times 2^{(midi - 69)/12}$), velocity curve shaping, and drum groove swing offsets.
  - Translates abstract timeline bars into absolute timestamps ($t_{seconds} = t_{start} + (\text{bar} \times 4 + \text{beat}) \times \frac{60}{\text{BPM}}$).

- **The Audio Graph**:
  - The real-time directed acyclic graph (DAG) of Web Audio `AudioNode` instances (`OscillatorNode`, `GainNode`, `BiquadFilterNode`, `DynamicsCompressorNode`, `ConvolverNode`, `StereoPannerNode`).
  - Parameter changes are executed using sample-accurate native Web Audio automation methods: `setValueAtTime`, `linearRampToValueAtTime`, and `exponentialRampToValueAtTime` to prevent clicks, zipper noise, and CPU overhead.

---

## 4. State Management & Offline-First Persistence

- **State Tree**: The song document is a pure JSON-serializable tree.
- **Undo / Redo**: Uses an immutable command stack with state snapshots, bounded to 50 historical states to avoid memory bloat.
- **IndexedDB**:
  - Database name: `sonicblueprint_db`
  - Store: `projects` (primary key `id`, indexes on `updatedAt`, `title`)
  - Autosave executes after a 500ms debounce on any state change.
  - Storage quotas are monitored with graceful warnings when approaching browser limits.
- **PWA Service Worker & Cache API**:
  - All application assets, icons, fonts, soundfont samples, and impulse responses are precached.
  - The application is 100% operational in air-gapped or offline environments.

---

## 5. Security Model & Data Integrity

1. **Zero External Data Transmission**:
   - Audio generation, MIDI rendering, WAV encoding, and MP3 processing take place exclusively within the user's browser sandbox.
   - Zero telemetry, analytics beacons, or audio snippet uploads.

2. **Project Import Sanitization**:
   - Imported JSON blueprints are thoroughly validated against a strict Zod / runtime schema.
   - Malformed structures, out-of-bound numerical values (e.g., frequencies > 24,000 Hz or gains > 10.0), and dangerous prototypes are stripped before state hydration.

3. **Content Security Policy (CSP)**:
   - Configured with strict script execution boundaries (`self`), restricting script injection, inline eval, and unvetted external resources.
