// Tests: Design tokens, theme registry, WCAG 2.1 AA contrast math, and theme store.
import { suite, test, ok, eq, approx } from "./helpers.js";
import {
  THEMES,
  DEFAULT_THEME,
  isValidTheme,
  getThemeTokens,
  parseHexColor,
  calculateRelativeLuminance,
  calculateContrastRatio,
  validateThemeContrast,
  type DawTheme,
} from "@/styles/themes";
import { useThemeStore } from "@/store/theme-store";

suite("Theme Registry & Token Completeness");

test("THEMES registry contains exactly cyberpunk, analog, and slate", () => {
  const themeIds = Object.keys(THEMES);
  eq(themeIds.sort(), ["analog", "cyberpunk", "slate"]);
});

test("every theme definition has valid metadata and token keys", () => {
  const requiredTokens = [
    "bgVoid",
    "bgPrimary",
    "bgSecondary",
    "bgSurface",
    "bgElevated",
    "bgInput",
    "borderSubtle",
    "borderInteractive",
    "borderFocus",
    "accentPrimary",
    "accentHover",
    "accentSecondary",
    "accentTertiary",
    "accentGlow",
    "textPrimary",
    "textSecondary",
    "textMuted",
    "textOnAccent",
    "meterRms",
    "meterPeak",
    "meterClip",
    "meterBg",
    "stepKick",
    "stepSnare",
    "stepHat",
    "stepAccent",
  ];

  for (const id of ["cyberpunk", "analog", "slate"] as DawTheme[]) {
    const def = THEMES[id];
    ok(def, `Theme ${id} must exist in THEMES`);
    eq(def.id, id);
    ok(def.name.length > 0, `Theme ${id} must have a name`);
    ok(def.label.length > 0, `Theme ${id} must have a label`);
    ok(def.description.length > 0, `Theme ${id} must have a description`);

    const tokenKeys = Object.keys(def.tokens);
    for (const req of requiredTokens) {
      ok(req in def.tokens, `Theme ${id} is missing token ${req}`);
      ok(
        typeof (def.tokens as Record<string, string>)[req] === "string",
        `Theme ${id} token ${req} must be a string`
      );
    }
    eq(tokenKeys.sort(), [...requiredTokens].sort(), `Theme ${id} token keys must match required set`);
  }
});

suite("WCAG 2.1 AA Contrast Ratio Algorithms");

test("relative luminance calculates boundary values accurately", () => {
  // Pure black
  approx(calculateRelativeLuminance("#000000"), 0.0, 1e-4);
  // Pure white
  approx(calculateRelativeLuminance("#ffffff"), 1.0, 1e-4);
  // 3-digit shorthand #fff
  approx(calculateRelativeLuminance("#fff"), 1.0, 1e-4);
});

test("hex parsing correctly unpacks 3-digit and 6-digit colors", () => {
  const rgb6 = parseHexColor("#00f3ff");
  eq(rgb6, { r: 0, g: 243, b: 255 });

  const rgb3 = parseHexColor("#f0c");
  eq(rgb3, { r: 255, g: 0, b: 204 });
});

test("contrast ratio correctly calculates 21:1 for pure black on pure white", () => {
  const ratio = calculateContrastRatio("#ffffff", "#000000");
  approx(ratio, 21.0, 0.05);
});

test("cyberpunk theme strictly satisfies all WCAG 2.1 AA text and UI contrast ratios", () => {
  const res = validateThemeContrast(THEMES.cyberpunk);
  ok(res.valid, `Cyberpunk contrast violations: ${res.violations.join("; ")}`);
  eq(res.violations.length, 0);

  // Check specific key ratios
  ok(res.metrics["textPrimary on bgVoid"] >= 15.0, "textPrimary on bgVoid should be high contrast (>15:1)");
  ok(res.metrics["textOnAccent on accentPrimary"] >= 7.0, "textOnAccent on accentPrimary should be high contrast");
  ok(res.metrics["borderInteractive on bgVoid"] >= 3.0, "borderInteractive on bgVoid must be >= 3.0:1");
});

test("analog theme strictly satisfies all WCAG 2.1 AA text and UI contrast ratios", () => {
  const res = validateThemeContrast(THEMES.analog);
  ok(res.valid, `Analog contrast violations: ${res.violations.join("; ")}`);
  eq(res.violations.length, 0);

  ok(res.metrics["textPrimary on bgVoid"] >= 14.0, "textPrimary on bgVoid must be >= 14:1");
  ok(res.metrics["textOnAccent on accentPrimary"] >= 7.0, "textOnAccent on accentPrimary must be >= 7.0:1");
  ok(res.metrics["borderInteractive on bgVoid"] >= 3.0, "borderInteractive on bgVoid must be >= 3.0:1");
});

test("slate theme strictly satisfies all WCAG 2.1 AA text and UI contrast ratios", () => {
  const res = validateThemeContrast(THEMES.slate);
  ok(res.valid, `Slate contrast violations: ${res.violations.join("; ")}`);
  eq(res.violations.length, 0);

  ok(res.metrics["textPrimary on bgVoid"] >= 15.0, "textPrimary on bgVoid must be >= 15:1");
  ok(res.metrics["textOnAccent on accentPrimary"] >= 7.0, "textOnAccent on accentPrimary must be >= 7.0:1");
  ok(res.metrics["borderInteractive on bgVoid"] >= 3.0, "borderInteractive on bgVoid must be >= 3.0:1");
});

suite("Theme Type Guard & Fallback Invariants");

test("isValidTheme correctly identifies valid and invalid themes", () => {
  ok(isValidTheme("cyberpunk"));
  ok(isValidTheme("analog"));
  ok(isValidTheme("slate"));

  ok(!isValidTheme("dark"));
  ok(!isValidTheme("light"));
  ok(!isValidTheme(""));
  ok(!isValidTheme(null));
  ok(!isValidTheme(undefined));
  ok(!isValidTheme(123));
});

test("getThemeTokens returns fallback default on unknown theme", () => {
  const def = getThemeTokens(DEFAULT_THEME);
  // @ts-expect-error testing invalid input fallback
  const fallback = getThemeTokens("unknown");
  eq(fallback.bgVoid, def.bgVoid);
  eq(fallback.accentPrimary, def.accentPrimary);
});

suite("Theme Store State Invariants");

test("useThemeStore updates theme and ignores invalid inputs", () => {
  const store = useThemeStore.getState();
  store.setTheme("analog");
  eq(useThemeStore.getState().theme, "analog");

  store.setTheme("slate");
  eq(useThemeStore.getState().theme, "slate");

  // @ts-expect-error testing runtime rejection
  store.setTheme("invalid_theme");
  eq(useThemeStore.getState().theme, "slate");

  store.setTheme("cyberpunk");
  eq(useThemeStore.getState().theme, "cyberpunk");
});
