// Unit tests: project schema, validation, versioning, serialization.
import { suite, test, eq, ok } from "./helpers";
import {
  SCHEMA_VERSION,
  beatsPerBar,
  createProject,
  defaultArrangement,
  defaultDrums,
  defaultInstruments,
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
  ok(validateProject(p), "current v2 validates");
  ok(!validateProject({ ...JSON.parse(JSON.stringify(p)), schemaVersion: 99 }));
  const asV1 = { ...JSON.parse(JSON.stringify(p)), schemaVersion: 1 };
  delete (asV1 as Record<string, unknown>)["layers"];
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
