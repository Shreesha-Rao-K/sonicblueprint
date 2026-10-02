// Unit tests: deterministic performance humanization (feel, not composition).
import { suite, test, eq, ok } from "./helpers";
import {
  drumFeel,
  familyFeel,
  normalizeLevel,
  performHash,
  seedHash,
} from "@/lib/humanize";
import { buildSongEvents } from "@/lib/audio-engine";
import {
  SCHEMA_VERSION,
  createProject,
  normalizeProject,
  validateProject,
  type SonicProject,
} from "@/lib/project-schema";
import { exportMidi } from "@/lib/midi-export";

function withFeel(p: SonicProject, humanize: unknown): SonicProject {
  return { ...p, config: { ...p.config, humanize: humanize as never } };
}

suite("feel model");

test("levels normalize, garbage falls back to subtle", () => {
  eq(normalizeLevel("off"), "off");
  eq(normalizeLevel("subtle"), "subtle");
  eq(normalizeLevel("natural"), "natural");
  eq(normalizeLevel(undefined), "subtle");
  eq(normalizeLevel("extreme"), "subtle");
  eq(normalizeLevel(42), "subtle");
});

test("seed hash is deterministic and seed-sensitive", () => {
  eq(seedHash("abc"), seedHash("abc"));
  ok(seedHash("abc") !== seedHash("abd"), "differs");
  ok(Number.isInteger(seedHash("x")) && seedHash("x") >= 0, "uint32");
});

test("perform hash is uniform-ish, bounded and deterministic", () => {
  for (const [s, t, id, c] of [[1, 100, 5, 0], [99, 0, 0, 2], [7, 99999, 300, 1]] as const) {
    const h = performHash(s, t, id, c);
    ok(h >= 0 && h < 1, "range");
    eq(h, performHash(s, t, id, c));
  }
  ok(performHash(1, 100, 5, 0) !== performHash(1, 100, 5, 1), "channel matters");
  ok(performHash(1, 100, 5, 0) !== performHash(2, 100, 5, 0), "seed matters");
});

test("families have distinct musical profiles", () => {
  ok(familyFeel("strings").timingMs > familyFeel("bass").timingMs, "strings breathe, bass sits");
  ok(familyFeel("pads").timingMs <= familyFeel("piano").timingMs, "pads calm");
  ok(drumFeel("kick").timingMs <= 2, "kit tight");
  ok(drumFeel("shaker").timingMs > drumFeel("kick").timingMs, "shakers breathe");
  eq(familyFeel("unknown-synth-xyz").timingMs, 6);
  for (const name of ["piano", "strings", "brass", "guitar", "pluck", "synth", "pad", "atmos", "bass", "perc"]) {
    const f = familyFeel(name);
    ok(f.timingMs >= 0 && f.timingMs <= 20, `${name} timing sane`);
    ok(f.vel >= 0 && f.vel <= 0.2, `${name} velocity sane`);
    ok(f.dur >= 0 && f.dur <= 0.1, `${name} duration sane`);
  }
});

suite("feel levels in builds");

test("off is deterministic and range-safe", () => {
  const p = withFeel(createProject("Exact"), "off");
  const a = buildSongEvents(p);
  const b = buildSongEvents(p);
  eq(
    a.notes.map((n) => n.time),
    b.notes.map((n) => n.time)
  );
  for (const n of a.notes) {
    ok(n.time >= 0, "no negative time");
    ok(n.vol >= 0.0001 && n.vol <= 1, "volume range");
  }
});

test("subtle keeps times exact and only breathes velocity", () => {
  const base = createProject("Feel");
  const off = buildSongEvents(withFeel(base, "off"));
  const sub = buildSongEvents(withFeel(base, "subtle"));
  eq(sub.notes.map((n) => n.time), off.notes.map((n) => n.time));
  eq(sub.drums.map((d) => d.time), off.drums.map((d) => d.time));
  ok(sub.notes.some((n, i) => n.vol !== off.notes[i].vol), "velocity breathes");
});

test("natural wanders timing but never composition", () => {
  const base = createProject("Feel");
  const off = buildSongEvents(withFeel(base, "off"));
  const nat = buildSongEvents(withFeel(base, "natural"));
  eq(nat.notes.map((n) => n.midi), off.notes.map((n) => n.midi));
  eq(nat.notes.length, off.notes.length);
  eq(nat.drums.length, off.drums.length);
  ok(nat.notes.some((n, i) => n.time !== off.notes[i].time), "timing wanders");
  for (const n of nat.notes) {
    ok(n.time >= 0, "no negative time");
    ok(n.dur >= 0.05, "duration floor");
  }
  // bounded by the widest family profile (strings 14ms + float slack)
  for (let i = 0; i < nat.notes.length; i++) {
    ok(Math.abs(nat.notes[i].time - off.notes[i].time) <= 0.015, "subtle bounds");
  }
});

test("natural is reproducible and seed-sensitive", () => {  const mk = (seed: string) =>
    withFeel(createProject("S", { originality: { melodySeed: seed } } as never), "natural");
  const a = buildSongEvents(mk("seed-a"));
  const b = buildSongEvents(mk("seed-a"));
  eq(
    a.notes.map((n) => n.time),
    b.notes.map((n) => n.time)
  );
  const c = buildSongEvents(mk("seed-b"));
  // same composition (chord-voice midis match), different performance
  const harmony = (ns: { synth: string; midi: number }[]) =>
    ns.filter((n) => n.synth === "piano").map((n) => n.midi);
  eq(harmony(c.notes), harmony(a.notes));
  // melody length itself is seed-composed; feel is proven by timing drift
  ok(c.notes.some((n, i) => i < a.notes.length && n.time !== a.notes[i].time), "seed changes feel");
});

suite("feel persistence and migration");

test("new projects default to subtle at schema v4", () => {
  const p = createProject("v");
  eq(p.schemaVersion, SCHEMA_VERSION);
  eq(p.config.humanize, "subtle");
  ok(validateProject(p));
});

test("v1-v3 projects migrate to subtle", () => {
  for (const v of [1, 2, 3]) {
    const raw = JSON.parse(JSON.stringify(createProject("old"))) as Record<string, unknown>;
    raw["schemaVersion"] = v;
    delete (raw as Record<string, unknown>)["layers"];
    delete (raw as Record<string, unknown>)["versions"];
    delete ((raw as Record<string, unknown>)["config"] as Record<string, unknown>)["humanize"];
    ok(validateProject(raw), `v${v} loads`);
    eq(normalizeProject(raw as unknown as SonicProject).config.humanize, "subtle");
  }
});

test("MIDI export is identical across feel levels", async () => {
  const base = createProject("Midi");
  const bytes = async (feel: unknown) =>
    new Uint8Array(await (await exportMidi(withFeel(base, feel))).arrayBuffer());
  const off = await bytes("off");
  const sub = await bytes("subtle");
  const nat = await bytes("natural");
  eq([...off], [...sub]);
  eq([...off], [...nat]);
});

test("stress project stays bounded under natural feel", () => {
  // 400-bar project across many voices: humanization must stay in bounds
  // and complete quickly (regression guard for pathological arrangements).
  const p = withFeel(createProject("Stress"), "natural");
  const secs = [];
  let remaining = 400;
  let i = 0;
  while (remaining > 0) {
    const bars = Math.min(8, remaining);
    secs.push({ id: `sec_${i}`, name: "VERSE", bars, energy: 6, instruments: [] as string[] });
    remaining -= bars;
    i++;
  }
  const big: SonicProject = { ...p, arrangement: secs };
  const t0 = Date.now();
  const s = buildSongEvents(big);
  const elapsed = Date.now() - t0;
  ok(s.notes.length > 1000, `many notes (${s.notes.length})`);
  for (const n of s.notes) {
    ok(n.time >= 0, "no negative time");
    ok(n.dur >= 0.05, "duration floor");
    ok(n.vol >= 0.0001 && n.vol <= 1, "volume range");
  }
  for (const d of s.drums) {
    ok(d.time >= 0, "drum time range");
  }
  ok(elapsed < 10000, `stress build took ${elapsed}ms (ceiling 10s)`);
});
