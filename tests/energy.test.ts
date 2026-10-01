// Unit tests: song-energy display language and its audio consistency.
import { suite, test, eq, ok } from "./helpers";
import { energyJourney, energyLabel } from "@/lib/energy";
import { buildSongEvents } from "@/lib/audio-engine";
import { createProject, normalizeProject, validateProject, type SonicProject } from "@/lib/project-schema";

suite("energy labels");

test("bands match the engine's audible gates", () => {
  eq(energyLabel(1), "Low");
  eq(energyLabel(3), "Low");
  eq(energyLabel(4), "Medium");
  eq(energyLabel(6), "Medium");
  eq(energyLabel(7), "High");
  eq(energyLabel(10), "High");
});

test("missing or wild values fall back to Medium", () => {
  eq(energyLabel(undefined), "Medium");
  eq(energyLabel(NaN), "Medium");
  eq(energyLabel("loud" as never), "Medium");
});

test("journey compresses repeats into a readable arc", () => {
  eq(energyJourney([{ energy: 2 }, { energy: 3 }, { energy: 8 }, { energy: 9 }, { energy: 2 }]), ["Low", "High", "Low"]);
  eq(energyJourney([]), []);
  eq(energyJourney([{ energy: 5 }]), ["Medium"]);
});

suite("energy persistence");

test("section energy survives JSON save and reload", () => {
  const p = createProject("Arc");
  const back = normalizeProject(JSON.parse(JSON.stringify(p)) as SonicProject);
  ok(validateProject(back));
  eq(back.arrangement.map((s) => s.energy), p.arrangement.map((s) => s.energy));
});

test("edited energy persists through normalize", () => {
  const p = createProject("Arc");
  p.arrangement[0].energy = 9;
  const back = normalizeProject(JSON.parse(JSON.stringify(p)) as SonicProject);
  eq(back.arrangement[0].energy, 9);
  eq(energyLabel(back.arrangement[0].energy), "High");
});

suite("energy audio consistency");

function allEnergy(p: SonicProject, energy: number): SonicProject {
  return { ...p, arrangement: p.arrangement.map((s) => ({ ...s, energy })) };
}

test("high energy audibly exceeds low energy", () => {
  const withSynthLive = (p: SonicProject): SonicProject => ({
    ...p,
    instruments: p.instruments.map((i) => (i.group === "synth" ? { ...i, enabled: true } : i)),
  });
  const low = buildSongEvents(allEnergy(withSynthLive(createProject("Calm")), 1));
  const high = buildSongEvents(allEnergy(withSynthLive(createProject("Loud")), 9));
  // synth arp layers only join at energy >= 4
  eq(low.notes.filter((n) => n.synth === "synth").length, 0);
  ok(high.notes.filter((n) => n.synth === "synth").length > 0, "high adds synth layers");
  // shared layers play louder when energy is high
  const pianoVol = (vol: typeof low.notes, synth: string) =>
    Math.max(...vol.filter((n) => n.synth === synth).map((n) => n.vol));
  ok(pianoVol(high.notes, "piano") > pianoVol(low.notes, "piano"), "high plays louder");
});
