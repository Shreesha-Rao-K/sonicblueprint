# SonicBlueprint User Guide

SonicBlueprint is a free, browser-based tool for designing instrumental songs visually: chords, drums, bass, instruments and song structure. You hear every edit instantly, and you can take home MP3, MIDI and PDF blueprints. No account, nothing to install.

## 1. Getting started

1. Open the **Dashboard** and choose **Create New Project** (blank song) or pick a **quick-start template** (13 finished examples, all fully editable).
2. The **studio** opens with panels: chords, drums, bass and melody, instruments, song structure, transport (play) bar, and export.
3. A 4-step guide at the top points at each panel; dismiss it any time.
4. Press **Play** in the top bar. Edit anything — the sound follows immediately.
5. Press **Save** when happy. **Undo** (Ctrl+Z) / **Redo** covers short-term edits.
6. Use **Export** (right column) for MP3, MIDI, PDF or a backup file.

The **Preset Library** (sidebar) holds all 40 chord loops, 20 drum patterns, 13 starters and 17 sounds. Search it, or filter by mood, energy, tempo and style.

## 2. Chords

- **Key**: pick the home note (e.g. D) and major/minor. All 40 loops transpose into your key automatically.
- **Progression**: choose a loop (shown as `Dm` plus plain words, *D minor*), or type your own chords freely (`Am7`, `G7`, `Cmaj7` work).
- **Transposition**: changing the key re-spells every chord; your loop choice is kept.
- **Beats per chord**, **octave**, **tap tempo**, and **time signature** (4/4, 3/4, 6/8, 12/8) shape timing. Tap any chord chip to hear it.

## 3. Rhythm

- The **step sequencer** is a grid: 8 drum voices (kick, snare, hats, clap, percussion, toms, shaker) across 8, 12 or 16 steps. Tap squares to toggle hits.
- Start from one of **20 patterns** (pop, rock, trap, cinematic, dance, ambient…), then reshape it — presets never lock you in.
- **Swing** loosens timing; **punch** (velocity) sets impact.
- Keyboard: Tab into the grid, arrows move, Space toggles. **Hear the drums** plays one bar.

## 4. Bass and melody

- **Bass** (8 styles): steady roots, octaves, held notes, driving pulse, rolling arps, deep rumble, syncopated groove, or draw **your own rhythm** on the gate grid. Bass always follows your chord roots, so it can't clash. Octave and loudness are adjustable.
- **Melody** (6 styles from Minimal to Decorated): scale-aware tunes generated from your key and chords. **New tune** keeps everything else and writes a fresh melody; style buttons set how busy it is.

## 5. Instruments

- 13 instrument groups (piano, guitar, strings, synth, bass, drums, percussion, pads, atmosphere, brass, plucks, arps, winds), 21 ready sounds — layer as many as you like.
- Sounds marked **Sampled** in the mixer play from licensed recordings of real instruments (grand piano, strings, cello, brass, French horn, flute, clarinet, harp, acoustic drums); the rest use the built-in synthesis. Sampled sounds load on first play and are cached; if they ever fail to load, backup synths play instead and the transport says so. Electric piano/organ/guitars/bass guitar/saxophone/mallets stay synthesized: no redistributable sample source was found for them.
- Loud notes play brighter recordings where the bank has real velocity layers (piano, strings, trumpet, drums); single-recording banks shape loudness only. Drum hits alternate between two recordings of the same hit so repeats don't sound mechanical.
- Everything shares a subtle generated room and a transparent ceiling that only catches stacked peaks — no per-instrument compression, no obvious echo. Bass stays near the center.
- Sample banks live decoded in memory while a project uses them (a full piano bank is the heaviest at roughly 130 MB decoded); banks for unused instruments are never loaded.
- Each mixer slot: on/off, loudness, left–right placement, pitch range, musical job (chords, tune, ripple…), character and playing style. Duplicates stack on purpose.

## 6. Arrangement

- **Sections** (INTRO, VERSE, CHORUS, …): add, duplicate, reorder, shorten/lengthen (bars), or delete (never the last one). Click any block to play from there; the purple "start" tag marks your entry point.
- **Energy** per part (1–10, shown as Low / Medium / High, with the song's journey summarized under the timeline). Energy is real: louder parts play louder, and layers join in as it rises (tunes rest at low energy, synth layers join at medium, brass at high). It is saved, reloaded and exported exactly as set.
- **Mix Layers** switches sit above the editors (see next section).

## 7. Musical layer toggles

Four switches — **Chords, Drums, Bass, Melody** — include or exclude each layer without deleting any settings. Muted layers go silent in preview and are left out of MP3 and MIDI (marked muted in the PDF). Use them to audition parts in isolation or to export, say, a drums-free backing track.

## 8. Projects

- Projects live **in your browser on your device** (see §11). The Dashboard lists recent work with search; **Saved Projects** manages the rest.
- **Save** stores the current state (with a save counter and timestamp). **Rename**, **duplicate** (safe way to try variations), **delete** (asks first).
- **Saved versions**: snapshot named milestones ("Bigger Chorus", "Final") from the studio's Saved Versions panel. Creating one never changes your song; restoring one asks first and can itself be undone.
- **Backup / import**: download one song's backup file (studio Export → Backup file), all songs at once (Settings → Back up all songs), or per-song (Projects page). Restore from the Projects page: files are checked before anything changes, multi-song files restore every song, and name clashes become "(restored)" copies instead of overwriting.

## 9. Export

| Format | What you get |
|---|---|
| MP3 | 128 kbps stereo reference recording, rendered and encoded in your browser (progress shown; long songs take a while) |
| MIDI | Chord, bass, drum and melody notes plus tempo and time signature — editable in GarageBand, FL Studio, Ableton… |
| PDF | Readable blueprint: key, tempo, chords, rhythm, instruments, section timeline |
| Backup (JSON) | The complete project file — reopen it on any device running the app |

Exports always render the **current** song state (muted layers excluded). Filenames follow your song name.

**Human feel and exports.** The transport bar's Human feel control (Exact / Subtle / Natural) shapes playback and MP3: Exact plays the grid precisely, Subtle is the classic SonicBlueprint feel, Natural adds human timing and dynamics. MIDI is different by design — it carries the composition itself (notes, tempo, time signature) with fixed reference velocities, so the same project always produces the same MIDI file regardless of the feel setting.

## 10. Troubleshooting

- **No sound when pressing Play.** Browsers sometimes block audio: press Play again (the click counts as permission). If a message appears, use **Try again**. Check the mute button and loudness slider, and that at least one instrument/layer is enabled. MP3 export uses a separate renderer and works even if live playback is blocked.
- **Lost or overwritten work.** Undo covers recent edits. For bigger losses, re-import a backup file (Projects → Restore backup). Without a backup, cleared browser data cannot be recovered — back up songs that matter.
- **Import failure.** The app explains the cause: unreadable file, too large (5 MB limit), made by a newer app version, or entries that failed checks (valid songs still import). Nothing changes unless the file checks out.
- **Storage limits.** Browsers cap local data and can clear it (private mode, "clear site data", device cleanup). Keep backup files for anything important; they are small (a song is a few kilobytes).

## 11. Privacy and local-first

Your songs stay **on your device, in your browser** — no account, no uploads, no tracking of your music. Backup files you download are yours to keep wherever you like. Clearing browser data removes local songs, which is exactly why backups exist.
