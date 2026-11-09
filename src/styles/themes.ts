// SonicBlueprint Design Tokens & Theme Architecture
// Fully WCAG 2.1 AA compliant themes: Cyberpunk Neon, Classic Analog Studio, Clean Minimal Slate.

export type DawTheme = "cyberpunk" | "analog" | "slate";

export interface ThemeTokens {
  // Layer Depths & Surfaces
  bgVoid: string;
  bgPrimary: string;
  bgSecondary: string;
  bgSurface: string;
  bgElevated: string;
  bgInput: string;

  // Structural & Interactive Borders
  borderSubtle: string;
  borderInteractive: string;
  borderFocus: string;

  // Accents & Lighting
  accentPrimary: string;
  accentHover: string;
  accentSecondary: string;
  accentTertiary: string;
  accentGlow: string;

  // Typography
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnAccent: string;

  // Audio Meters & Signal Indicators
  meterRms: string;
  meterPeak: string;
  meterClip: string;
  meterBg: string;

  // Drum Sequencer Step Pads
  stepKick: string;
  stepSnare: string;
  stepHat: string;
  stepAccent: string;
}

export interface ThemeDefinition {
  id: DawTheme;
  name: string;
  label: string;
  description: string;
  tokens: ThemeTokens;
}

export const THEMES: Record<DawTheme, ThemeDefinition> = {
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Neon",
    label: "Cyber",
    description: "High-intensity futuristic hardware synthesizer aesthetic with electric cyan and neon purple accents.",
    tokens: {
      bgVoid: "#090a0f",
      bgPrimary: "#0c0e17",
      bgSecondary: "#121524",
      bgSurface: "#181c2e",
      bgElevated: "#20253d",
      bgInput: "#0f121e",

      borderSubtle: "#262d47",
      borderInteractive: "#526391",
      borderFocus: "#00f3ff",

      accentPrimary: "#00f3ff",
      accentHover: "#33f6ff",
      accentSecondary: "#bc13fe",
      accentTertiary: "#ffb703",
      accentGlow: "0 0 16px rgba(0, 243, 255, 0.45)",

      textPrimary: "#f0f6fc",
      textSecondary: "#cbd5e1",
      textMuted: "#9da7c0",
      textOnAccent: "#04060b",

      meterRms: "#00f3ff",
      meterPeak: "#ffaa00",
      meterClip: "#ff0055",
      meterBg: "#151b2e",

      stepKick: "#00f3ff",
      stepSnare: "#bc13fe",
      stepHat: "#ffb703",
      stepAccent: "#ff007f",
    },
  },
  analog: {
    id: "analog",
    name: "Classic Analog Studio",
    label: "Analog",
    description: "Warm vintage console aesthetic inspired by legendary Neve and SSL desks with warm illuminated VU meters.",
    tokens: {
      bgVoid: "#161412",
      bgPrimary: "#1c1917",
      bgSecondary: "#24201c",
      bgSurface: "#2c2723",
      bgElevated: "#38322d",
      bgInput: "#1e1a17",

      borderSubtle: "#443c36",
      borderInteractive: "#78675a",
      borderFocus: "#e5a93c",

      accentPrimary: "#e5a93c",
      accentHover: "#f0b852",
      accentSecondary: "#d97736",
      accentTertiary: "#a39744",
      accentGlow: "0 0 14px rgba(229, 169, 60, 0.35)",

      textPrimary: "#f7f4ed",
      textSecondary: "#d6cfc4",
      textMuted: "#a89f91",
      textOnAccent: "#1b1408",

      meterRms: "#e5a93c",
      meterPeak: "#ea580c",
      meterClip: "#dc2626",
      meterBg: "#2b2520",

      stepKick: "#e5a93c",
      stepSnare: "#d97736",
      stepHat: "#f5eedc",
      stepAccent: "#b91c1c",
    },
  },
  slate: {
    id: "slate",
    name: "Clean Minimal Slate",
    label: "Slate",
    description: "Ultra-precise European mastering suite layout with cool slate modules and crisp Swiss cobalt highlights.",
    tokens: {
      bgVoid: "#0f172a",
      bgPrimary: "#131d35",
      bgSecondary: "#1a2640",
      bgSurface: "#223150",
      bgElevated: "#2b3d63",
      bgInput: "#152037",

      borderSubtle: "#334155",
      borderInteractive: "#64748b",
      borderFocus: "#38bdf8",

      accentPrimary: "#38bdf8",
      accentHover: "#60a5fa",
      accentSecondary: "#818cf8",
      accentTertiary: "#34d399",
      accentGlow: "0 0 12px rgba(56, 189, 248, 0.3)",

      textPrimary: "#f8fafc",
      textSecondary: "#cbd5e1",
      textMuted: "#94a3b8",
      textOnAccent: "#031726",

      meterRms: "#38bdf8",
      meterPeak: "#f59e0b",
      meterClip: "#ef4444",
      meterBg: "#1e293b",

      stepKick: "#38bdf8",
      stepSnare: "#818cf8",
      stepHat: "#34d399",
      stepAccent: "#f43f5e",
    },
  },
};

export const DEFAULT_THEME: DawTheme = "cyberpunk";
export const THEME_STORAGE_KEY = "sonic_theme";

export function isValidTheme(val: unknown): val is DawTheme {
  return typeof val === "string" && (val === "cyberpunk" || val === "analog" || val === "slate");
}

export function getThemeTokens(theme: DawTheme): ThemeTokens {
  const def = THEMES[theme] || THEMES[DEFAULT_THEME];
  return def.tokens;
}

export function getStoredTheme(): DawTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isValidTheme(raw)) return raw;
  } catch {
    // ignore security/storage exceptions
  }
  return DEFAULT_THEME;
}

export function applyTheme(theme: DawTheme): void {
  if (typeof document === "undefined") return;
  const target = isValidTheme(theme) ? theme : DEFAULT_THEME;
  try {
    document.documentElement.setAttribute("data-theme", target);
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(THEME_STORAGE_KEY, target);
    }
  } catch {
    // ignore storage restrictions
  }
}

// ----------------------------------------------------------------------------
// WCAG 2.1 AA Mathematical Contrast Calculation & Validation
// ----------------------------------------------------------------------------

export function parseHexColor(hex: string): { r: number; g: number; b: number } {
  let cleaned = hex.trim().replace(/^#/, "");
  if (cleaned.length === 3) {
    cleaned = cleaned.split("").map((c) => c + c).join("");
  }
  const num = parseInt(cleaned, 16);
  if (isNaN(num)) {
    return { r: 0, g: 0, b: 0 };
  }
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function calculateRelativeLuminance(hex: string): number {
  const { r, g, b } = parseHexColor(hex);
  const transform = (c: number): number => {
    const norm = c / 255;
    return norm <= 0.04045 ? norm / 12.92 : Math.pow((norm + 0.055) / 1.055, 2.4);
  };
  const rLin = transform(r);
  const gLin = transform(g);
  const bLin = transform(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

export function calculateContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const lum1 = calculateRelativeLuminance(foregroundHex);
  const lum2 = calculateRelativeLuminance(backgroundHex);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

export interface ContrastValidationResult {
  valid: boolean;
  violations: string[];
  metrics: Record<string, number>;
}

export function validateThemeContrast(theme: ThemeDefinition): ContrastValidationResult {
  const violations: string[] = [];
  const metrics: Record<string, number> = {};
  const t = theme.tokens;

  // Text requirements: >= 4.5:1 for normal text (WCAG 2.1 AA)
  const textChecks = [
    { label: "textPrimary on bgVoid", fg: t.textPrimary, bg: t.bgVoid, min: 4.5 },
    { label: "textPrimary on bgSurface", fg: t.textPrimary, bg: t.bgSurface, min: 4.5 },
    { label: "textMuted on bgVoid", fg: t.textMuted, bg: t.bgVoid, min: 4.5 },
    { label: "textMuted on bgSurface", fg: t.textMuted, bg: t.bgSurface, min: 4.5 },
    { label: "textOnAccent on accentPrimary", fg: t.textOnAccent, bg: t.accentPrimary, min: 4.5 },
  ];

  // Graphical elements: >= 3.0:1 for borders and interactive components
  const uiChecks = [
    { label: "borderInteractive on bgVoid", fg: t.borderInteractive, bg: t.bgVoid, min: 3.0 },
    { label: "borderFocus on bgVoid", fg: t.borderFocus, bg: t.bgVoid, min: 3.0 },
    { label: "accentPrimary on bgVoid", fg: t.accentPrimary, bg: t.bgVoid, min: 3.0 },
  ];

  for (const check of [...textChecks, ...uiChecks]) {
    const ratio = calculateContrastRatio(check.fg, check.bg);
    metrics[check.label] = Math.round(ratio * 100) / 100;
    if (ratio < check.min) {
      violations.push(`${check.label}: got ${ratio.toFixed(2)}:1, expected >= ${check.min}:1`);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    metrics,
  };
}
