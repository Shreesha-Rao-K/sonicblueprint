# Third-party notices

SonicBlueprint ships the following third-party packages to end users (production bundle).
License identifiers below are quoted verbatim from each package's own `package.json`
(`SPDX` field) as installed on 2026-09-30. This file is informational only and
is not legal advice.

## Runtime dependencies (shipped to browsers)

| Package | Installed version | License (as declared by the package) |
|---|---|---|
| next | 16.3.7 | MIT |
| react | 19.2.8 | MIT |
| react-dom | 19.2.8 | MIT |
| zustand | 5.0.15 | MIT |
| lucide-react | 0.469.0 | ISC |
| @tonejs/midi | 2.0.28 | MIT |
| jspdf | 4.2.1 | MIT |
| @breezystack/lamejs | 1.2.7 | LGPL-3.0 |

Notes:

- `@breezystack/lamejs` (MP3 encoder) is the only shipped dependency that is
  not permissively licensed. It is loaded dynamically at runtime, only when the
  user clicks MP3 export, and is never modified or statically linked into the
  application source. Review the LGPL-3.0 terms yourself if you redistribute
  this application.
- `jspdf`, `@tonejs/midi` and `@breezystack/lamejs` are loaded on demand
  (dynamic `import()`); the other packages above form the initial bundle.

## Build/dev-only dependencies (not shipped to browsers)

tailwindcss 4.3.3 (MIT), @tailwindcss/postcss 4.3.3 (MIT), typescript 5.9.3
(Apache-2.0), tsx 4.23.15 (MIT), eslint 9.39.5 (MIT),
eslint-config-next 16.3.7 (MIT), @types/node 20.19.43 (MIT),
@types/react 19.3.0 (MIT), @types/react-dom 19.3.0 (MIT).

## Bundled audio samples (shipped as static files under `public/samples/`)

These are converted subsets (44.1 kHz MP3) of freely licensed sample
libraries — not the complete distributions. See `scripts/make-samples.md`
for the exact subset recipe so the bundle can be reproduced and audited.

| Source | Used for | License | Redistribution | Attribution |
|---|---|---|---|---|
| Salamander Grand Piano v3, Alexander Holm (Yamaha C5; single mf velocity, minor 3rds) | `samples/piano/*.mp3` (Grand Piano, Bright Upright) | CC-BY-3.0 | Permitted with attribution | "Grand piano samples: Salamander Grand Piano by Alexander Holm, CC-BY-3.0" — retain this credit when redistributing the samples or the app |
| VSCO-2 Community Edition, Versilian Studios (violin/cello sustains, trumpet staccato, orchestral percussion hits) | `samples/violin/`, `samples/cello/`, `samples/trumpet/`, `samples/drums/` | CC0-1.0 (public domain) | Permitted, no conditions | Not required; credited here voluntarily |
| VSCO-2 Community Edition, Versilian Studios (French horn sustains, flute/clarinet sustains, harp plucks) | `samples/horn/`, `samples/flute/`, `samples/clarinet/`, `samples/harp/` | CC0-1.0 (public domain) | Permitted, no conditions | Not required; credited here voluntarily |

Notes:

- CC-BY-3.0 requires attribution "in any reasonable manner": the credit
  above appears here, in `scripts/make-samples.md`, and in the app's user
  guide. Do not remove it while the Salamander-derived files are bundled.
- CC0 works carry no attribution requirement; Versilian Studios is credited
  above as a courtesy.
- Rendered song audio (MP3 exports, playback) created with these samples is
  the user's own musical work product; no sample-library royalties apply
  (CC0 unconditionally; CC-BY-3.0 Salamander covers the recording as
  distributed here with attribution, per its license).

## Project license status

SonicBlueprint itself currently carries no open-source license
(all rights reserved). That is independent of the licenses above, which apply
to their respective packages only.
