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

## Project license status

SonicBlueprint itself currently carries no open-source license
(all rights reserved). That is independent of the licenses above, which apply
to their respective packages only.
