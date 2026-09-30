# Contributing to SonicBlueprint

Thanks for your interest in contributing. This guide keeps the codebase coherent for everyone.

## Getting started

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # must pass before any PR
npm test           # unit + integration tests
npm run build      # must pass before any PR
npx -y tsx qa/audio-qa.mts   # audio regression tests must stay green
```

No database, accounts, API keys or environment variables are needed for local development.

## How to contribute

1. Fork the repository and create a focused branch (`feature/…`, `fix/…`, `docs/…`).
2. Make your change — one concern per pull request.
3. Run `npm run typecheck`, `npm run lint`, `npm run build` and `npx -y tsx qa/audio-qa.mts`.
4. Open a pull request using the provided template, describing what changed and how you verified it.

Bug reports and feature requests are equally welcome — please use the issue templates so reports include reproduction steps.

## Code style

- **Strict TypeScript.** No `any` without justification, no unused exports, no dead code.
- **Small, focused components.** One studio panel per file under `src/components/`. Never put the application into a single file and never duplicate logic — extract shared code into `src/lib/`.
- **No unnecessary dependencies.** Prefer platform APIs (Web Audio, IndexedDB, Canvas) over new packages. Any new dependency must be justified in the PR.
- **Client components only where needed.** Pages that render statically stay server components; interactivity lives in `"use client"` components.
- **Accessible by default.** Every control needs an accessible name, keyboard operation must mirror pointer operation, status changes belong in live regions, and body text must meet WCAG AA contrast on the dark theme. See the component patterns in `DrumSequencer` (roving tabindex) and `TransportBar` before building custom controls.
- **Plain-language copy.** The product is for first-time musicians: explain controls in words, keep tooltips concise, never remove advanced functionality to simplify.

## Audio engine rules

`src/lib/audio-engine.ts` is the most sensitive file in the project:

- UI components must never touch Web Audio directly — go through `WebAudioEngine`.
- `buildSongEvents()` is the single source of truth for musical events. Realtime preview and offline export share it; do not fork event generation per output.
- New synthesis must exist in **both** the realtime `voice()`/`drumVoice()` and the offline `scheduleSegment()` paths so exports sound like previews.
- Keep event math on the integer quarter-note grid and deterministic (seeded/hash-based variation only) so renders are reproducible.
- Every change here must keep `qa/audio-qa.mts` green — extend it when you change event behavior.

## Adding presets (no UI changes needed)

Presets are data. To grow the library, append entries — never hard-code preset UIs:

- Chord loops → `CHORD_PROGRESSIONS` in `src/data/chords.ts` (reference spelling + major/minor context; the UI transposes automatically)
- Drum patterns → `DRUM_PRESETS` in `src/data/drums.ts` (paint the step grid in `build()`)
- Song starters, instruments, bass/tune styles, moods → `src/data/styles.ts`

Use honest descriptions. Do not name presets after existing commercial songs or artists.

## What not to submit

- AI/ML features or claims — the product is explicitly **not** AI-generated music, and marketing must never suggest otherwise.
- Anything that weakens the originality guarantees in copy: the app must never promise uniqueness or protection from third-party similarity detection.
- Lock-in formats or account walls around export, backup or restore.

## License note

This repository currently carries no open-source license. By submitting a pull request you confirm you have the right to share the work; if a license is adopted later, contributions may be included under it.
