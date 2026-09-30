// Originality check — inspects the PROJECT ITSELF, never claims to
// guarantee third-party similarity outcomes.
import type { SonicProject } from "./project-schema";

export interface OriginalityFinding {
  level: "pass" | "info" | "warn" | "flag";
  title: string;
  detail: string;
}

export function checkOriginality(p: SonicProject): OriginalityFinding[] {
  const out: OriginalityFinding[] = [];
  const o = p.originality;

  if (o.usesImportedRecording) {
    out.push({
      level: "flag",
      title: "Someone else's recording is in here",
      detail: "You ticked that this song contains an imported recording. Check its license before sharing or releasing your song.",
    });
  }
  if (o.usesCommercialSample) {
    out.push({
      level: "flag",
      title: "A bought or downloaded sample is in here",
      detail: "You ticked that this song uses a commercial sample. Make sure you're allowed to use it, or swap it for sounds you make here.",
    });
  }
  if (o.usesCopiedMelody) {
    out.push({
      level: "flag",
      title: "A pasted-in tune is in here",
      detail: "You ticked that the tune came from elsewhere. Rewrite it or press “New tune” so the song is truly yours.",
    });
  }
  if (o.repeatedMelody) {
    out.push({
      level: "warn",
      title: "The tune repeats itself a lot",
      detail: "Try pressing “New tune”, or give the bridge and final chorus their own feel by changing instruments there.",
    });
  } else {
    out.push({
      level: "pass",
      title: "Tune has variety",
      detail: "Nothing here repeats word-for-word — every part gets its own variation of the tune.",
    });
  }

  // Heuristic: preset-only composition (tolerant of partial data).
  const customized =
    (typeof p.chords?.progressionId === "string" && p.chords.progressionId.startsWith("custom")) ||
    (typeof p.drums?.patternId === "string" && p.drums.patternId.startsWith("custom")) ||
    p.bass?.styleId === "custom" ||
    o.presetOnly === false;
  if (!customized && o.presetOnly) {
    out.push({
      level: "info",
      title: "Built from ready-made parts — a fine start",
      detail: "Everything currently comes from presets. To make it yours, try your own chords, tap some drum squares, or press “New tune”.",
    });
  } else {
    out.push({
      level: "pass",
      title: "You've shaped it yourself",
      detail: "We can see your own edits to chords, drums, bass or tune. This song is on its way to being truly yours.",
    });
  }

  out.push({
    level: "pass",
    title: "Rhythm made fresh in your browser",
    detail: "Drums and bass are played live from your patterns — not copied from a recording.",
  });

  return out;
}

export const ORIGINALITY_DISCLAIMER =
  "Designed for original composition. This check cannot guarantee uniqueness or prevent similarity detection by third-party services.";
