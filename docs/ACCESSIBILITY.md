# SonicBlueprint Accessibility (a11y) & Screen Reader Architecture

## 1. Compliance Statement & Standards

SonicBlueprint is engineered to comply with **WCAG 2.1 Level AA** standards. Digital audio workstations have historically presented extreme barriers for blind, low-vision, and motor-impaired musicians due to visual-only canvas interfaces, lack of keyboard focus indicators, and unlabelled interactive controls. SonicBlueprint eliminates these barriers by providing comprehensive screen reader support, keyboard navigability across every panel, and high-contrast styling.

---

## 2. WCAG 2.1 AA Compliance Matrix

| WCAG SC | Criterion Name | Level | Implementation Strategy & Proof in SonicBlueprint |
|---|---|---|---|
| **1.1.1** | Non-text Content | A | All icons use `aria-hidden="true"` accompanied by descriptive parent button labels; SVG piano keys and fretboard dots have explicit `aria-label` tags. |
| **1.3.1** | Info and Relationships | A | Semantic HTML5 elements (`header`, `main`, `nav`, `section`, `dialog`), proper ARIA roles (`switch`, `slider`, `grid`, `gridcell`, `radiogroup`, `radio`). |
| **1.4.3** | Contrast (Minimum) | AA | Text contrast ratios strictly $\ge 4.5:1$ against dark backgrounds; primary brand buttons achieve $\ge 7:1$. |
| **1.4.11** | Non-text Contrast | AA | Sliders, knobs, grid cells, and focus rings maintain $\ge 3:1$ contrast against adjacent background colors. |
| **2.1.1** | Keyboard Accessible | A | 100% of functionality accessible via standard keyboard inputs (`Tab`, `Arrows`, `Enter`, `Space`, `Home`, `End`, `Escape`). |
| **2.1.2** | No Keyboard Trap | A | Modals and bottom drawers feature focus traps with clean `Escape` escape hatches returning focus to triggering elements. |
| **2.4.3** | Focus Order | A | Logical DOM sequence matching visual reading flow; zero disconnected tab jumps. |
| **2.4.7** | Focus Visible | AA | Universal high-visibility focus indicators (`ring-2 ring-[#6e8bff] ring-offset-2 ring-offset-[#06070d]`). |
| **4.1.2** | Name, Role, Value | A | Custom tactile knobs and sliders provide `role="slider"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and descriptive `aria-valuetext` (e.g. `"-6 dB"` or `"120 BPM"`). |
| **4.1.3** | Status Messages | AA | Dual ARIA live regions (`polite` and `assertive`) announce transport states, tempo adjustments, preset hydration, and sequencer toggles. |

---

## 3. ARIA Live Region Architecture (`a11y-announcer.ts`)

Screen reader users receive instantaneous verbal feedback without shifting keyboard focus:

```
+---------------------------------------------------------------------------------+
|                                a11y-announcer.ts                                |
|  - Global singleton publisher                                                   |
|  - Debounces high-frequency events (e.g. rapid slider scrubbing)               |
+---------------------------------------------------------------------------------+
                                       |
                                       v
+---------------------------------------------------------------------------------+
|                             A11yLiveAnnouncer.tsx                               |
|  +-------------------------------------+  +----------------------------------+  |
|  |  aria-live="polite" aria-atomic     |  | aria-live="assertive"            |  |
|  |  - Song loading, preset hydration   |  | - Transport play / pause / stop  |  |
|  |  - Step pad toggled (on/off)        |  | - Error alerts, export ready     |  |
|  |  - Tempo changes (BPM)              |  |                                  |  |
|  +-------------------------------------+  +----------------------------------+  |
+---------------------------------------------------------------------------------+
```

### Announcer APIs:
- `announce(message, priority)`: Low-level dispatcher.
- `announceTransport(state, tempo)`: Verbalizes `"Playback started at 120 BPM"`, `"Playback paused"`, or `"Playback stopped"`.
- `announceTempo(bpm)`: Debounced announcement of tempo changes.
- `announcePreset(presetName, type)`: Verbalizes `"Hydrated chord preset: Neo-Soul 9th"`.
- `announceSequencer(voiceName, stepIndex, state)`: Verbalizes `"Kick, step 1 toggled on"`.

---

## 4. Roving Tabindex Implementations

### 1. 8x16 Drum Sequencer Grid
- The entire 128-cell grid acts as a single tab stop (`tabindex="0"` for the active cell, `tabindex="-1"` for all other 127 cells).
- Arrow keys (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`) navigate between steps and drum voices.
- `Home` jumps to step 1 of current track; `End` jumps to step 16.
- `Space` and `Enter` toggle step activation and trigger audio audition.

### 2. 37-Key Virtual Piano Preview
- The keyboard container maintains focus on the active MIDI note.
- `ArrowLeft` / `ArrowRight` navigate chromatically ($+/- 1\text{ semitone}$).
- `ArrowDown` / `ArrowUp` jump by octaves ($+/- 12\text{ semitones}$).
- `Space` and `Enter` play the note and trigger live vocal readout.

### 3. Theme Switcher Radio Group
- Implements WAI-ARIA Radio Group pattern.
- Arrow keys switch radio buttons with immediate visual and audible confirmation.

---

## 5. Keyboard Navigation Matrix

| Component | Key Binding | Action |
|---|---|---|
| **Global Studio** | `Space` | Toggle Play / Pause transport (safely bypassed inside inputs & cells) |
| | `?` or `Shift + /` | Open Keyboard Shortcuts Modal |
| | `Escape` | Close active modal, drawer, or dropdown menu |
| **Drum Sequencer** | `ArrowLeft` / `ArrowRight` | Move focus between steps (1 to 16) |
| | `ArrowUp` / `ArrowDown` | Move focus between drum voices (Kick to Shaker) |
| | `Space` or `Enter` | Toggle active step trigger and audition voice |
| | `Home` / `End` | Jump to step 1 or step 16 of the selected drum voice |
| **Tactile Knobs & Sliders** | `ArrowUp` / `ArrowRight` | Increment parameter value by 1 step |
| | `ArrowDown` / `ArrowLeft`| Decrement parameter value by 1 step |
| | `PageUp` / `PageDown` | Increment / decrement by 10% |
| | `Home` / `End` | Jump to minimum or maximum bound |
| **Piano Keyboard** | `ArrowLeft` / `ArrowRight` | Step chromatically down/up (semitone) |
| | `ArrowDown` / `ArrowUp` | Shift down/up one full octave (12 semitones) |
| | `Space` or `Enter` | Audition note sound and announce pitch |
| **Fretboard Dots** | `Enter` or `Space` | Select string, fret, or chord inversion |
| **Arrangement Timeline** | `Tab` / `Shift + Tab` | Move between section duration and energy buttons |
| | `Enter` / `Space` | Adjust section length or change section order |

---

## 6. High Contrast & Forced Colors (`forced-colors: active`)

SonicBlueprint includes dedicated CSS rules to support Windows High Contrast Mode and the CSS `prefers-contrast: more` media query:

```css
@media (forced-colors: active) {
  /* System colors mapped to active controls */
  [role="switch"][aria-checked="true"],
  [role="button"][aria-pressed="true"],
  [data-active="true"] {
    forced-color-adjust: none;
    background-color: Highlight !important;
    color: HighlightText !important;
    border-color: Highlight !important;
  }

  button:focus-visible,
  [tabindex="0"]:focus-visible {
    outline: 3px solid Highlight !important;
    outline-offset: 3px !important;
  }
}

@media (prefers-contrast: more) {
  :root {
    --border-subtle: #4b5563;
    --border-strong: #9ca3af;
  }
}
```

---

## 7. Assistive Technology Testing Notes

The accessibility architecture has been validated against major screen readers:
1. **NVDA (NonVisual Desktop Access)** on Windows 11 (Google Chrome, Mozilla Firefox).
2. **Apple VoiceOver** on macOS Sonoma (Safari, Chrome).
3. **Orca Screen Reader** on Linux Ubuntu.
