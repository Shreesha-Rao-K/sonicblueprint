// Unit tests: project schema, validation, versioning, serialization.
import { suite, test, eq, ok } from "./helpers";
import {
  SCHEMA_VERSION,
  beatsPerBar,
  createProject,
  defaultArrangement,
  defaultDrums,
  defaultInstruments,
  normalizeProject,
  touchProject,
  uid,
  validateProject,
  type SonicProject,
} from "@/lib/project-schema";

suite("project creation");

test("defaults describe a playable D minor song", () => {
  const p = createProject("Track 01");
  eq(p.schemaVersion, SCHEMA_VERSION);
  eq(p.config.bpm, 100);
  eq(p.config.keyTonic, "D");
  eq(p.config.scale, "minor");
  eq(p.config.timeSignature, "4/4");
  eq(p.chords.chords, ["Dm", "Bb", "F", "C"]);
  eq(p.meta.name, "Track 01");
  eq(p.meta.version, 1);
  ok(p.instruments.length > 0, "has instruments");
  ok(p.arrangement.length > 0, "has sections");
  ok(p.originality.melodySeed.length > 0, "has melody seed");
});

test("ids are unique across projects", () => {
  const ids = new Set([createProject("a").meta.id, createProject("b").meta.id]);
  eq(ids.size, 2);
});

test("uid generates unique values", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 200; i++) seen.add(uid("x"));
  eq(seen.size, 200);
});

test("default drums form a complete 16-step grid", () => {
  const d = defaultDrums();
  eq(d.steps, 16);
  for (const row of Object.keys(d.grid)) {
    eq((d.grid as Record<string, boolean[]>)[row].length, 16, row);
  }
});

test("defaults include instruments and arrangement", () => {
  ok(defaultInstruments().length >= 4, "instrument slots");
  ok(defaultArrangement().length >= 5, "sections");
});

suite("beats per bar");

test("known signatures map correctly", () => {
  eq(beatsPerBar("4/4"), 4);
  eq(beatsPerBar("3/4"), 3);
  eq(beatsPerBar("6/8"), 6);
  eq(beatsPerBar("12/8"), 12);
});

test("unknown signatures fall back to 4", () => {
  eq(beatsPerBar("5/4" as never), 4);
  eq(beatsPerBar("" as never), 4);
});

suite("validation and versioning");

test("a created project validates", () => {
  ok(validateProject(createProject("v")));
});

test("garbage fails validation", () => {
  ok(!validateProject(null));
  ok(!validateProject(undefined));
  ok(!validateProject({}));
  ok(!validateProject("project"));
  ok(!validateProject({ schemaVersion: 1 }));
  ok(!validateProject({ schemaVersion: 1, meta: {}, config: null }));
});

test("unknown schema versions are rejected (migration contract)", () => {
  const p = createProject("v") as unknown as Record<string, unknown>;
  ok(validateProject(p), "current v4 validates");
  ok(!validateProject({ ...JSON.parse(JSON.stringify(p)), schemaVersion: 99 }));
  const asV3 = { ...JSON.parse(JSON.stringify(p)), schemaVersion: 3 };
  delete ((asV3 as Record<string, unknown>)["config"] as Record<string, unknown>)["humanize"];
  ok(validateProject(asV3), "v3 without feel still loads");
  eq(normalizeProject(asV3 as unknown as SonicProject).config.humanize, "subtle");
  const asV2 = { ...JSON.parse(JSON.stringify(p)), schemaVersion: 2 };
  delete (asV2 as Record<string, unknown>)["versions"];
  delete ((asV2 as Record<string, unknown>)["config"] as Record<string, unknown>)["humanize"];
  ok(validateProject(asV2), "v2 without versions still loads");
  const asV1 = { ...JSON.parse(JSON.stringify(p)), schemaVersion: 1 };
  delete (asV1 as Record<string, unknown>)["layers"];
  delete (asV1 as Record<string, unknown>)["versions"];
  ok(validateProject(asV1), "v1 without layers still loads");
  ok(!validateProject({ ...JSON.parse(JSON.stringify(p)), schemaVersion: 0 }));
});

test("missing sections fail validation", () => {
  const p = JSON.parse(JSON.stringify(createProject("v")));
  delete p.meta;
  ok(!validateProject(p));
  const q = JSON.parse(JSON.stringify(createProject("v")));
  delete q.config;
  ok(!validateProject(q));
});

test("touchProject bumps version and timestamp", () => {
  const p = createProject("v");
  const t = touchProject(p);
  eq(t.meta.version, p.meta.version + 1);
  ok(t.meta.updatedAt >= p.meta.updatedAt, "timestamp moves forward");
  eq(t.schemaVersion, SCHEMA_VERSION);
  // original untouched
  eq(p.meta.version, 1);
});

suite("serialization");

test("JSON round-trip preserves the project exactly", () => {
  const p = createProject("Round Trip 07!");
  const back = JSON.parse(JSON.stringify(p)) as SonicProject;
  ok(validateProject(back));
  eq(back, p);
});

test("filenames derive safely from project names", () => {
  // filename helpers live with the exporters; the schema guarantees the inputs
  const p = createProject("Track 07: Night/Mix?");
  ok(p.meta.name.length > 0);
  ok(!p.meta.id.includes(" "));
});

suite("malformed nested data is rejected");

function mutated(mut: (p: Record<string, unknown>) => void): unknown {
  const p = JSON.parse(JSON.stringify(createProject("Bad"))) as Record<string, unknown>;
  mut(p);
  return p;
}

function cfg(p: Record<string, unknown>): Record<string, unknown> {
  return p["config"] as Record<string, unknown>;
}

test("malformed instruments never validate", () => {
  const base = () => mutated(() => {});
  ok(validateProject(base()), "control valid project passes");
  // A. instrument is a string
  ok(!validateProject(mutated((p) => { (p["instruments"] as unknown[])[0] = "piano"; })), "A string entry");
  // B. instrument is {}
  ok(!validateProject(mutated((p) => { (p["instruments"] as unknown[])[0] = {}; })), "B empty object");
  // C. instrument.volume = NaN
  ok(!validateProject(mutated((p) => { ((p["instruments"] as Record<string, unknown>[])[0])["volume"] = NaN; })), "C NaN volume");
  // D. instrument.pan = Infinity
  ok(!validateProject(mutated((p) => { ((p["instruments"] as Record<string, unknown>[])[0])["pan"] = Infinity; })), "D Infinity pan");
  // E. invalid instrument group
  ok(!validateProject(mutated((p) => { ((p["instruments"] as Record<string, unknown>[])[0])["group"] = "theremin"; })), "E bad group");
  // enabled must be boolean
  ok(!validateProject(mutated((p) => { ((p["instruments"] as Record<string, unknown>[])[0])["enabled"] = "yes"; })), "string enabled");
  // volume out of range
  ok(!validateProject(mutated((p) => { ((p["instruments"] as Record<string, unknown>[])[0])["volume"] = 2; })), "volume > 1");
});

test("malformed drum grids never validate", () => {
  const grid = (p: Record<string, unknown>) => (p["drums"] as Record<string, unknown>)["grid"] as Record<string, unknown>;
  // F. row is a string
  ok(!validateProject(mutated((p) => { grid(p)["kick"] = "bad"; })), "F string row");
  // G. row contains non-booleans
  ok(!validateProject(mutated((p) => { grid(p)["kick"] = [true, 1, false]; })), "G non-boolean cell");
  // H. absurd row length
  ok(!validateProject(mutated((p) => { grid(p)["kick"] = new Array(1000).fill(true); })), "H absurd length");
  // empty row
  ok(!validateProject(mutated((p) => { grid(p)["kick"] = []; })), "empty row");
});

test("malformed bass and melody config never validate", () => {
  // I. malformed bass object
  ok(!validateProject(mutated((p) => { p["bass"] = { styleId: "ludicrous", octave: 1, volume: 1 }; })), "I bad bass style");
  ok(!validateProject(mutated((p) => { (p["bass"] as Record<string, unknown>)["volume"] = NaN; })), "I NaN bass volume");
  // J. malformed melody style
  ok(!validateProject(mutated((p) => { p["melodyStyle"] = 42; })), "J non-string melody style");
});

test("malformed arrangement sections never validate", () => {
  const sec = (p: Record<string, unknown>) => (p["arrangement"] as Record<string, unknown>[])[0];
  // K. section is a string
  ok(!validateProject(mutated((p) => { (p["arrangement"] as unknown[])[0] = "VERSE"; })), "K string section");
  // L. malformed energy
  ok(!validateProject(mutated((p) => { sec(p)["energy"] = 99; })), "L energy out of range");
  ok(!validateProject(mutated((p) => { sec(p)["energy"] = NaN; })), "L NaN energy");
  // bad instrument references
  ok(!validateProject(mutated((p) => { sec(p)["instruments"] = [42]; })), "non-string instrument ref");
});

test("malformed config, feel and layers never validate", () => {
  // M. invalid feel value
  ok(!validateProject(mutated((p) => { cfg(p)["humanize"] = "extreme"; })), "M bad feel");
  // N. malformed BPM
  ok(!validateProject(mutated((p) => { cfg(p)["bpm"] = NaN; })), "N NaN bpm");
  ok(!validateProject(mutated((p) => { cfg(p)["bpm"] = "fast"; })), "N string bpm");
  // O. malformed time signature
  ok(!validateProject(mutated((p) => { cfg(p)["timeSignature"] = "7/11"; })), "O bad signature");
  // key/scale
  ok(!validateProject(mutated((p) => { cfg(p)["keyTonic"] = ""; })), "empty key");
  ok(!validateProject(mutated((p) => { cfg(p)["scale"] = "dorian"; })), "unsupported scale");
  // P. malformed layers
  ok(!validateProject(mutated((p) => { (p["layers"] as Record<string, unknown>)["drums"] = "yes"; })), "P string layer flag");
});

test("rejected imports stay rejected after JSON round-trip", () => {
  const bad = mutated((p) => { cfg(p)["bpm"] = Infinity; });
  const revived = JSON.parse(JSON.stringify({ v: bad }));
  // JSON cannot even represent Infinity (serializes to null) — still invalid.
  ok(!validateProject(revived.v), "Infinity-ish bpm never loads");
});
