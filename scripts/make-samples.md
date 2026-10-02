# Sample bundle recipe (reproducible, auditable)

`public/samples/*.mp3` are converted subsets of two freely licensed
libraries. This file records exactly which files were taken and how they
were converted, so anyone can reproduce or audit the bundle.

## Sources

- **Salamander Grand Piano v3**, Alexander Holm — CC-BY-3.0
  (https://github.com/sfzinstruments/SalamanderGrandPiano).
  Yamaha C5, recorded every minor 3rd, 16 velocities.
- **VSCO-2 Community Edition**, Versilian Studios — CC0-1.0
  (https://github.com/sgossner/VSCO-2-CE).

## Subset taken

- Piano (Salamander v3): every minor 3rd A1–C7, three genuine velocities —
  v5 (soft), v12 (med), v16 (ff) → `piano/{soft,med,loud}/<Note>.mp3`.
- Violin ensemble: susVib v1 (soft) + v2 (loud) → `violin/{soft,loud}/`.
- Cello section: susvib v1 (soft) + v3 (loud) → `cello/{soft,loud}/`.
- Trumpet: staccato v1 (soft) + v2 (med) + v3 (loud) → `trumpet/{soft,med,loud}/`.
- French horn: sustains v2 (mf) → `horn/sus/` (11 notes A0–F4; C#3–C4 gap falls back to synth).
- Flute: susvib v1 (mf) → `flute/sus/` (10 notes C3–C6, fully covered).
- Clarinet: susLong v2 (mf) → `clarinet/sus/` (11 notes D2–Gb5, fully covered).
- Harp: mf plucks → `harp/pluck/` (18 notes E1–D6, fully covered).
- Drums: `Percussion/` bass-drum v1/v4/v7, snare v1/v5/v9, log-drum v1/v3,
  conga v1/v3 (each `_rr1` + `_rr2` round-robin takes, renamed to
  `kick|snare|tom|perc_<soft|med|loud>[2].mp3`). Round-robins are distinct
  recordings (byte-compared, never identical); the engine cycles them
  deterministically per hit count, so exports reproduce exactly.

New single-velocity banks (horn/flute/clarinet/harp) map velocity to gain
only — documented honestly in the manifest, never presented as multi-layer.

Level-verified dynamics (ffmpeg volumedetect mean_volume): trumpet v1→v3
≈ +19 dB, cello v1→v3 ≈ +14 dB, violin v1→v2 ≈ +6 dB. These are recorded
dynamic layers, not gain fakes — velocity also crossfades between neighbors
within a 0.06 band (see `pickLayerVoices` in `src/lib/sample-bank.ts`).

The exact note lists live in `src/lib/sample-manifest.ts` (the manifest is
the source of truth; this file is the provenance record).

## Conversion (per file)

```bash
ffmpeg -y -i INPUT \
  -af silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB \
  -t 6 -ar 44100 -codec:a libmp3lame -q:a 4 \
  public/samples/<family>/<layer>/<note>.mp3
```

- Leading digital silence trimmed so attacks land on time.
- Tails limited to 6 s (short hits unaffected): arrangement notes re-articulate
  far sooner, and the engine's own release envelope always fades first, so the
  cap is click-free and inaudible in songs while roughly halving decoded memory.
- Tails limited to 6 s with a 0.2 s safety fade: arrangement notes re-articulate
  far sooner, and the engine's own release envelope always lands first — so the
  cap is inaudible in songs while roughly halving decoded memory.
- 44.1 kHz to match the export renderer; MP3 (not FLAC/WAV) because every
  browser `decodeAudioData` implementation reads it and files stay ~20x smaller.
- No EQ, compression, normalization or looping added: envelopes, velocity
  mapping and room are applied at playback time by the engine.

## Attribution

Keep the Salamander credit in `THIRD-PARTY-NOTICES.md` while the derived
piano files are bundled (CC-BY-3.0 requirement). VSCO-2 CE files are CC0
and require no credit.
