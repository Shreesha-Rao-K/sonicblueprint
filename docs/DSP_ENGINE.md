# SonicBlueprint Digital Signal Processing (DSP) Engine

## 1. Overview & AudioContext Lifecycle

The SonicBlueprint DSP engine is an in-browser audio synthesis and processing system built directly on the Web Audio API standard. It produces zero-latency interactive audio during composition and faster-than-realtime batch rendering during offline export.

### AudioContext Initialization & Latency Optimization
- **Interactive Latency**: Initialized with `{ latencyHint: "interactive" }`, prompting the host operating system (CoreAudio, WASAPI, or ALSA) to request the smallest hardware buffer size available (typically 128 to 256 samples, yielding < 5.8ms hardware buffer latency at 44.1/48 kHz).
- **Lookahead Scheduling Window**:
  - Web Audio executes on a dedicated real-time audio thread, while JavaScript executes on the main browser UI thread.
  - To prevent buffer underruns and jitter caused by UI garbage collection or layout reflows, SonicBlueprint uses a dual-timer lookahead scheduler:
    - **Interval**: 25ms tick cadence via `setInterval`.
    - **Schedule Ahead Time**: 35ms lead-time buffer (`currentTime + 0.035s`).
  - Events occurring within the window `[currentTime, currentTime + 0.035]` are committed to the Web Audio clock via sample-accurate parameter automations.

---

## 2. Polyphonic Subtractive Synthesizer Architecture

Each voice in the polyphonic synthesizer employs a dual-oscillator subtractive architecture with an analog-modeled signal path:

```
[Oscillator 1 (Saw/Square/Sine)] --\
                                     +--> [Mixer Gain] --> [Moog-style 4-Pole Lowpass Biquad] --> [VCA Gain] --> [Pan]
[Oscillator 2 (Detuned +/- Cents)] -/                                 ^                               ^
                                                                      |                               |
                                                              [Filter ADSR Env]               [Amp ADSR Env]
```

### Oscillator Detune & Phase Drift
Oscillators feature controllable pitch detuning ($f_2 = f_1 \times 2^{(\text{detune\_cents} / 1200)}$) and micro-phase offsets to produce rich unison chorusing and phase motion characteristic of analog hardware.

---

## 3. ADSR Envelope Mathematical Formulation

SonicBlueprint implements exponential time constants for natural acoustic decay and release, matching physical acoustic energy dissipation.

For an envelope with stages:
- **Attack ($T_a$)**: Linear or exponential ramp from $0$ to Peak ($V_{peak}$):
  $$V(t) = V_{peak} \times \frac{t - t_0}{T_a}$$
- **Decay ($T_d$)**: Exponential decay toward Sustain level ($V_s$):
  $$V(t) = V_s + (V_{peak} - V_s) \times e^{-\frac{t - t_{decay\_start}}{\tau_d}}$$
  where $\tau_d = \frac{T_d}{4.605}$ ensures a drop to within 1% of target.
- **Sustain ($V_s$)**: Level maintained while gate is active ($0.0 \le V_s \le 1.0$).
- **Release ($T_r$)**: Exponential decay from active level $V_{release\_start}$ to $0.0001$ (clamped to 0 at completion):
  $$V(t) = V_{release\_start} \times e^{-\frac{t - t_{release\_start}}{\tau_r}}$$

All envelope transformations utilize native Web Audio methods:
`linearRampToValueAtTime` for fast percussive attack, and `exponentialRampToValueAtTime` for smooth musical decay and release.

---

## 4. Drum Machine Voice Synthesis

The 8-voice drum engine models classic analog rhythm machines (TR-808, TR-909) and modern acoustic kits entirely with synthetic primitives:

1. **Kick Drum**:
   - Fast pitch drop from 160 Hz down to 45 Hz over 45ms using `exponentialRampToValueAtTime`.
   - Parallel click generator (short bandpass noise burst, 2ms) blended with a sub-bass sine body.
2. **Snare Drum**:
   - Dual-sine tonal body (180 Hz and 330 Hz) with short decay.
   - High-passed white noise generator passed through a dynamic envelope modeling the snare wire rattle.
3. **Hi-Hats (Closed & Open)**:
   - Bandpass-filtered metallic noise cluster (combination of 6 non-harmonic square oscillators at 245 Hz, 306 Hz, 384 Hz, 421 Hz, 513 Hz, and 619 Hz).
   - Highpass filter cutoff at 7,000 Hz with fast exponential VCA decay (40ms for closed hat, 350ms for open hat).
   - Choke group routing: Triggering a closed hi-hat instantly sends an exponential fade-out to any ringing open hi-hat voice.
4. **Clap, Toms, Percussion**:
   - Multi-burst transient envelope (3 micro-clicks spaced 12ms apart followed by diffuse tail) for authentic handclap acoustics.
   - Resonant bandpass sine bursts with pitch envelopes for low/mid/high toms.

---

## 5. Master Effects Chain & DSP Algorithms

All instrument and drum channels sum into the master stereo effects processing bus:

### 1. 3-Band Parametric Equalizer
- **Low Shelf**: 100 Hz cutoff frequency, $+/- 12\text{ dB}$ gain, $Q = 0.707$ (Butterworth response).
- **Mid Peaking**: 1,000 Hz center frequency, $+/- 12\text{ dB}$ gain, variable $Q$ ($0.5$ to $4.0$).
- **High Shelf**: 8,000 Hz cutoff frequency, $+/- 12\text{ dB}$ gain, $Q = 0.707$.

### 2. VCA Dynamic Range Compressor & Sidechain
- Implemented via `DynamicsCompressorNode` with configurable parameters:
  - **Threshold**: $-40\text{ dB}$ to $0\text{ dB}$.
  - **Knee**: $0\text{ dB}$ (hard) to $12\text{ dB}$ (soft musical transition).
  - **Ratio**: $1:1$ to $20:1$ (limiting).
  - **Attack**: $0.001\text{s}$ to $0.1\text{s}$.
  - **Release**: $0.05\text{s}$ to $1.0\text{s}$.
- **Sidechain Routing**: Kick drum hits trigger dynamic gain ducking on bass and chord buses to maintain low-end headroom and mix clarity.

### 3. Stereo Chorus & Ping-Pong Delay
- **Chorus**: Dual delay lines modulated in quadrature ($90^\circ$ phase difference) by a low-frequency oscillator (LFO) running at $0.4\text{ Hz}$ to $2.5\text{ Hz}$, mixed with dry signal for rich stereo widening.
- **Ping-Pong Delay**: Tempo-synchronized delay taps ($1/8\text{D}$, $1/8\text{T}$, $1/4$) alternating between left and right channels with feedback filtering to tame high-frequency buildup.

### 4. Convolution & Algorithmic Reverb
- **Impulse Response Engine**: `ConvolverNode` loaded with studio room and hall impulse responses.
- **Algorithmic Fallback**: Synthesized exponentially decaying stereo white noise burst with Schroeder-Moorer allpass diffuser network for zero-download reverb generation.

---

## 6. Chord Algebra, Voice Leading & Harmony Engine

SonicBlueprint's harmony system translates symbolic music theory into rich polyphonic voicings:

1. **Pitch Class Mapping**:
   - Chromatic pitch classes $C = 0, C\sharp = 1, \dots, B = 11$.
   - Scale degree generation based on major, natural minor, harmonic minor, dorian, and mixolydian modes.
2. **Drop-2 Jazz Voicing**:
   - In a closed 4-note voicing (Root, 5th, 7th, 3rd), the second voice from the top is transposed down one octave ($-12\text{ semitones}$).
   - Creates open, resonant acoustic spacing that prevents low-mid muddy frequency clash on piano and guitar previewers.
3. **Smooth Voice Leading**:
   - Inversion algorithm minimizes total pitch distance travel between sequential chords:
     $$\Delta_{\text{voice}} = \sum_{i=1}^{N} |p_{i, \text{next}} - p_{i, \text{prev}}|$$
   - Automatically selects inversions that maintain common tones and move non-harmonic tones by step ($\le 2\text{ semitones}$).

---

## 7. Export Pipeline: Lossless WAV & MIDI

### Faster-Than-Realtime OfflineAudioContext
- Rendering executes in a separate background thread via `OfflineAudioContext(2, sampleRate * duration, sampleRate)`.
- A 3-minute composition renders in approximately 1.5 to 2.5 seconds on modern CPU hardware.

### 16-Bit / 24-Bit Linear PCM WAV Encoding
- Direct binary serialization of IEEE 754 float32 samples to 16-bit signed integer little-endian PCM format with standard 44-byte RIFF header structure (`RIFF`, `WAVE`, `fmt `, `data`).

### Standard MIDI File (SMF Type 1) Generator
- Multi-track MIDI export containing:
  - Track 0: Conductor track (Tempo meta-events, Time Signature meta-events).
  - Track 1: Chords and harmony channel.
  - Track 2: Bassline channel.
  - Track 3: Melody and lead channel.
  - Track 4: Drum kit channel (General MIDI drum map mapping: Kick = 36, Snare = 38, Closed Hat = 42, Open Hat = 46).
