// Tests: Mobile DAW Ergonomics, Snap Detents, Touch Target Specifications, and Viewport Safety.
import { suite, test, ok, eq } from "./helpers.js";
import { calculateSnapDetent } from "@/lib/sequencer-kinetics";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

suite("Mobile Bottom Drawer Snap Detents");

test("calculateSnapDetent finds closest detent at rest (zero velocity)", () => {
  const detents = [0, 0.45, 0.9];

  // At 0.2 -> closest is 0.0
  eq(calculateSnapDetent(0.2, 0.0, detents), 0);

  // At 0.35 -> closest is 0.45
  eq(calculateSnapDetent(0.35, 0.0, detents), 0.45);

  // At 0.55 -> closest is 0.45
  eq(calculateSnapDetent(0.55, 0.0, detents), 0.45);

  // At 0.75 -> closest is 0.9
  eq(calculateSnapDetent(0.75, 0.0, detents), 0.9);
});

test("calculateSnapDetent honors downward flick velocity towards dismissal", () => {
  const detents = [0, 0.45, 0.9];
  // Current ratio is 0.5 (near half-open), but fast downward flick (+0.6)
  const target = calculateSnapDetent(0.5, 0.6, detents);
  eq(target, 0.45);

  // From 0.4 with strong downward flick -> snaps to 0 (dismiss)
  const dismiss = calculateSnapDetent(0.4, 0.6, detents);
  eq(dismiss, 0);
});

test("calculateSnapDetent honors upward flick velocity towards full screen expansion", () => {
  const detents = [0, 0.45, 0.9];
  // Current ratio is 0.35, but strong upward flick (-0.6) -> snaps to 0.45 or 0.9
  const target = calculateSnapDetent(0.35, -0.6, detents);
  eq(target, 0.45);

  const expandToFull = calculateSnapDetent(0.55, -0.6, detents);
  eq(expandToFull, 0.9);
});

suite("Mobile Touch Target & Viewport Ergonomic Invariants");

test("mobile sequencer pad touch target meets minimum 48px height specification", () => {
  const drumSource = readFileSync(
    resolve(process.cwd(), "src/components/DrumSequencer.tsx"),
    "utf-8"
  );
  // Match tactile-pad element definition and verify min-h-[48px] specification on mobile
  const mobilePadMatch = /tactile-pad[^\n"]*?\bmin-h-\[(\d+)px\]/.exec(drumSource);
  ok(mobilePadMatch, "DrumSequencer must define tactile-pad with explicit mobile min-h-[...px]");
  const minPadHeightMobilePx = Number(mobilePadMatch[1]);
  ok(
    minPadHeightMobilePx >= 48,
    `Mobile drum pad height (${minPadHeightMobilePx}px) must meet or exceed 48px WCAG touch target specification`
  );

  // Ensure responsive desktop override is also declared
  const desktopPadMatch = /tactile-pad[^\n"]*?sm:min-h-\[(\d+)px\]/.exec(drumSource);
  ok(desktopPadMatch, "DrumSequencer must define desktop sm:min-h-[...px] responsive override");

  ok(
    drumSource.includes("touch-none"),
    "DrumSequencer step pads must enforce touch-none to prevent browser gesture conflicts"
  );
});

test("mobile bottom navigation dock targets are at least 48x48px", () => {
  const appShellSource = readFileSync(
    resolve(process.cwd(), "src/components/AppShell.tsx"),
    "utf-8"
  );
  ok(
    appShellSource.includes('aria-label="Mobile Navigation Dock"'),
    "AppShell must include Mobile Navigation Dock"
  );
  const minHMatch = /min-h-\[(\d+)px\]/.exec(appShellSource);
  const minWMatch = /min-w-\[(\d+)px\]/.exec(appShellSource);
  ok(minHMatch && minWMatch, "Mobile dock items must define explicit min-h and min-w in pixels");
  const navItemHeightPx = Number(minHMatch[1]);
  const navItemWidthPx = Number(minWMatch[1]);
  ok(navItemHeightPx >= 48, `Dock item height (${navItemHeightPx}px) must be >= 48px`);
  ok(navItemWidthPx >= 48, `Dock item width (${navItemWidthPx}px) must be >= 48px`);
  ok(
    appShellSource.includes("pb-safe"),
    "Mobile navigation dock must apply pb-safe class for safe area inset"
  );
});

test("safe area inset padding preserves bottom home indicator margin", () => {
  const cssSource = readFileSync(
    resolve(process.cwd(), "src/app/globals.css"),
    "utf-8"
  );
  ok(cssSource.includes(".pb-safe"), "globals.css must define .pb-safe utility class");
  ok(
    cssSource.includes("env(safe-area-inset-bottom"),
    "pb-safe must use env(safe-area-inset-bottom) for iPhone home indicator clearance"
  );

  const fallbackRemMatch = /max\(([\d.]+)rem/.exec(cssSource);
  ok(fallbackRemMatch, "pb-safe must enforce a fallback rem padding value");
  const minSafeBottomMarginPx = parseFloat(fallbackRemMatch[1]) * 16;
  ok(
    minSafeBottomMarginPx >= 12,
    `Safe area bottom fallback (${minSafeBottomMarginPx}px) must be at least 12px (0.75rem)`
  );

  const drawerSource = readFileSync(
    resolve(process.cwd(), "src/components/MobileBottomDrawer.tsx"),
    "utf-8"
  );
  ok(
    drawerSource.includes("pb-safe"),
    "MobileBottomDrawer surface must apply pb-safe to clear bottom home indicator"
  );
});
