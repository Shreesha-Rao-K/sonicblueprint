// Song-energy display language. Thresholds mirror the audio engine's real
// gates (melody ≥3, synth layers ≥4, brass ≥7) so labels never promise what
// the sound doesn't do: Low sections are audibly sparser and quieter.
export type EnergyLabel = "Low" | "Medium" | "High";

export function energyLabel(energy: unknown): EnergyLabel {
  const v = typeof energy === "number" && Number.isFinite(energy) ? energy : 6;
  if (v <= 3) return "Low";
  if (v <= 6) return "Medium";
  return "High";
}

/** Compressed label journey across sections, e.g. ["Low", "High", "Low"].
 * Consecutive repeats collapse so the arc reads as a progression. */
export function energyJourney(sections: { energy: unknown }[]): EnergyLabel[] {
  const out: EnergyLabel[] = [];
  for (const s of sections) {
    const label = energyLabel(s.energy);
    if (out[out.length - 1] !== label) out.push(label);
  }
  return out;
}
