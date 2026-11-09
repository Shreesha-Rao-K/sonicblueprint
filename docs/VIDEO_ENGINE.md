# SonicBlueprint Video Generation & Rendering Engine

## 1. Architectural Philosophy & Video Pipeline

SonicBlueprint incorporates a programmatic video creation and animation engine powered by **Remotion** and headless Chrome rendering. The video engine generates high-fidelity walkthrough tutorials, feature showcases, and social media shorts (YouTube Shorts, TikTok, Instagram Reels) directly from code and project JSON states.

```
+--------------------+      +--------------------+      +---------------------+
|  Project State or  | ---> | React Video Canvas | ---> | Remotion Frame      |
|  Tutorial Cues VTT |      | Compositions (30fps|      | Renderer (Headless) |
+--------------------+      +--------------------+      +---------------------+
                                                                   |
                                                                   v
+--------------------+      +--------------------+      +---------------------+
| MP4 H.264 / AAC    | <--- | FFmpeg Audio/Video | <--- | Raw Image Frames    |
| Master Outputs     |      | Multiplexing       |      | & Synthesized Audio |
+--------------------+      +--------------------+      +---------------------+
```

---

## 2. Remotion Composition Architecture

Video scenes are structured as deterministic React functional components parameterized by frame index:

- **FPS**: 30 frames per second standard broadcast rate.
- **Resolution**:
  - Landscape (Desktop/Web): $1920 \times 1080$ ($16:9$ aspect ratio).
  - Portrait (Mobile/Shorts): $1080 \times 1920$ ($9:16$ aspect ratio).
- **Hooks & Interpolation**:
  - `useCurrentFrame()` and `useVideoConfig()` drive all animations.
  - `interpolate()` provides linear, clamped, and exponential easing curves.
  - `spring()` physics generates organic, overshoot-free movement for UI focus transformations.

---

## 3. Spring-Driven Virtual Camera Rig

To produce professional tutorial walkthroughs, the engine includes a virtual camera rig that smoothly pans and zooms into specific DAW components (e.g., zooming from full studio view to the Chord Voicing panel, then panning down to the Drum Sequencer):

```tsx
// Virtual camera transform computation
const cameraSpring = spring({
  frame: currentFrame - chapterStartFrame,
  fps,
  config: { damping: 14, mass: 0.8, stiffness: 85 },
});

const scale = interpolate(cameraSpring, [0, 1], [previousZoom, targetCallout.zoom]);
const translateX = interpolate(cameraSpring, [0, 1], [previousX, -targetCallout.x]);
const translateY = interpolate(cameraSpring, [0, 1], [previousY, -targetCallout.y]);
```

Features:
- **Automatic Viewport Clamping**: Prevents the camera from showing empty space outside the DAW bounds.
- **Dynamic Depth of Field Blur**: Surrounding panels blur softly during intense zoom focus, highlighting the active control.

---

## 4. FFT Spectrum Visualizer & Audio Reactivity

The visualizer transforms audio time-domain and frequency-domain data into reactive animations:

1. **Logarithmic Frequency Binning**:
   - Web Audio `AnalyserNode` returns linear FFT bins (e.g., 1024 points).
   - The visualizer maps these into 32 to 64 logarithmically spaced musical bands (20 Hz to 20,000 Hz) using octave bin pooling:
     $$f_{\text{bin}} = f_{\min} \times \left(\frac{f_{\max}}{f_{\min}}\right)^{\frac{i}{N}}$$
2. **Temporal Smoothing & Peak Hold**:
   - Attack time constant: $0.1$ (instant transient response).
   - Decay time constant: $0.85$ (smooth, organic fall-off).
   - Peak markers hold their positions for 8 frames before decaying.
3. **Audio-Reactive Neon Glow**:
   - The root mean square (RMS) energy modulates CSS box-shadows and canvas bloom effects, causing panels and pads to pulse in sync with the beat.

---

## 5. Neural Voiceover & WebVTT Timeline Synchronization

SonicBlueprint synchronizes studio visual demonstrations with spoken voiceover and interactive subtitles:

- **WebVTT Cue Alignment**:
  - Cues define `startTime`, `endTime`, `text`, and associated UI chapter actions.
  - Subtitle renderer highlights the currently spoken word using word-level timing offsets.
- **Audio Ducking**:
  - When voiceover dialogue is active, background DAW audio is automatically ducked by $-6\text{ dB}$ via sidechain envelope follower, ensuring crystal-clear vocal intelligibility.

---

## 6. FFmpeg Mastering Pipeline

Final output encoding is handled via FFmpeg with production-grade compression flags:

```bash
# 1080p Landscape Master
ffmpeg -y -framerate 30 -i frames/%06d.png -i master_audio.wav \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 320k -ar 48000 \
  -movflags +faststart output_1080p.mp4

# 9:16 Vertical Shorts Master
ffmpeg -y -framerate 30 -i vertical_frames/%06d.png -i master_audio.wav \
  -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p \
  -c:a aac -b:a 256k -ar 48000 \
  -movflags +faststart output_shorts_9x16.mp4
```

- **`-crf 18`**: Visually lossless compression for high-contrast UI graphics and fine typography.
- **`-movflags +faststart`**: Relocates the `moov` atom to the beginning of the file, enabling instant video streaming playback without full file download.
