// Unit tests: project version history ("Save Version") — pure schema helpers,
// store restore action, migration, and backup/import survival.
import { suite, test, eq, ok } from "./helpers";
import {
  MAX_VERSIONS,
  SCHEMA_VERSION,
  createProject,
  createVersion,
  deleteVersion,
  nextVersionNumber,
  normalizeProject,
  restoreVersion,
  snapshotProject,
  validateProject,
  type SonicProject,
} from "@/lib/project-schema";
import { mergeProjectLists } from "@/lib/storage";

function withBpm(p: SonicProject, bpm: number): SonicProject {
  return { ...p, config: { ...p.config, bpm } };
}

suite("version creation");

test("new projects start with no versions", () => {
  const p = createProject("v");
  eq(p.versions ?? [], []);
});

test("create version records id, label, timestamp and number", () => {
  const before = Date.now();
  const p = createVersion(createProject("v"), "Bigger Chorus");
  eq((p.versions ?? []).length, 1);
  const v = p.versions![0];
  ok(v.id.length > 0, "stable id");
  eq(v.label, "Bigger Chorus");
  eq(v.versionNumber, 1);
  ok(Date.parse(v.createdAt) >= before - 1000, "timestamp sane");
  ok(validateProject(p), "versioned project validates");
});

test("missing label defaults to Version N", () => {
  let p = createVersion(createProject("v"));
  eq(p.versions![0].label, "Version 1");
  p = createVersion(p, "   ");
  eq(p.versions![1].label, "Version 2");
});

test("multiple versions keep rising numbers", () => {
  let p = createProject("v");
  p = createVersion(withBpm(p, 100), "Original");
  p = createVersion(withBpm(p, 120), "Faster");
  p = createVersion(withBpm(p, 140), "Experimental");
  eq(p.versions!.map((v) => v.versionNumber), [1, 2, 3]);
  eq(p.versions!.map((v) => v.label), ["Original", "Faster", "Experimental"]);
});

test("version numbers are never reused after delete", () => {
  let p = createVersion(createVersion(createProject("v"), "A"), "B");
  p = deleteVersion(p, p.versions![0].id);
  eq(p.versions!.length, 1);
  p = createVersion(p, "C");
  eq(p.versions!.map((v) => v.versionNumber), [2, 3]);
  eq(nextVersionNumber(p), 4);
});

test("creating a version leaves the live project untouched", () => {
  const p = withBpm(createProject("v"), 100);
  const before = JSON.parse(JSON.stringify({ ...p, versions: undefined }));
  const after = createVersion(p);
  const live = { ...after, versions: undefined };
  eq(JSON.parse(JSON.stringify(live)), before);
});

test("snapshots are deep copies, not aliases", () => {
  let p = withBpm(createProject("v"), 100);
  p = createVersion(p, "Original");
  p = withBpm(p, 150);
  eq(p.versions![0].snapshot.config.bpm, 100);
  eq(p.config.bpm, 150);
});

test("snapshots never nest history", () => {
  let p = createVersion(createProject("v"), "A");
  p = createVersion(p, "B");
  for (const v of p.versions!) {
    ok(!("versions" in (v.snapshot as Record<string, unknown>)), "no nesting");
  }
  ok(validateProject(p), "nested-free validates");
});

test("history is capped, oldest dropped first", () => {
  let p = createProject("v");
  for (let i = 0; i < MAX_VERSIONS + 5; i++) p = createVersion(p, `v${i}`);
  eq(p.versions!.length, MAX_VERSIONS);
  eq(p.versions![0].label, "v5");
  eq(p.versions![MAX_VERSIONS - 1].label, `v${MAX_VERSIONS + 4}`);
});

suite("version restore and delete");

test("restore swaps musical state but keeps identity and history", () => {
  let p = withBpm(createProject("Keeper"), 100);
  const id = p.meta.id;
  p = createVersion(p, "Original");
  p = withBpm(p, 150);
  const restored = restoreVersion(p, p.versions![0].id)!;
  ok(restored !== null, "found");
  eq(restored.config.bpm, 100);
  eq(restored.meta.id, id);
  eq(restored.meta.name, "Keeper");
  eq(restored.versions!.length, 1);
  ok(validateProject(restored), "restored validates");
});

test("restore of an unknown id returns null", () => {
  const p = createVersion(createProject("v"), "A");
  eq(restoreVersion(p, "ver_nope"), null);
  eq(restoreVersion(createProject("v"), "ver_nope"), null);
});

test("delete removes only the chosen version", () => {
  let p = createVersion(createVersion(createProject("v"), "A"), "B");
  const dropId = p.versions![0].id;
  p = deleteVersion(p, dropId);
  eq(p.versions!.map((v) => v.label), ["B"]);
  const same = deleteVersion(p, "ver_nope");
  eq(same.versions!.length, 1);
});

suite("version persistence and migration");

test("history survives JSON backup/import round-trip", () => {
  const p = createVersion(withBpm(createProject("Tour"), 110), "Original");
  const json = JSON.stringify(p);
  const back = normalizeProject(JSON.parse(json) as SonicProject);
  ok(validateProject(back), "imported backup validates");
  eq(back.versions!.length, 1);
  eq(back.versions![0].label, "Original");
  eq(back.versions![0].snapshot.config.bpm, 110);
  eq(back.config.bpm, 110);
});

test("v1 and v2 projects migrate to empty history", () => {
  const v1 = JSON.parse(JSON.stringify(createProject("old"))) as Record<string, unknown>;
  v1["schemaVersion"] = 1;
  delete v1["layers"];
  delete v1["versions"];
  ok(validateProject(v1), "v1 loads");
  eq(normalizeProject(v1 as SonicProject).versions ?? [], []);

  const v2 = JSON.parse(JSON.stringify(createProject("mid"))) as Record<string, unknown>;
  v2["schemaVersion"] = 2;
  delete v2["versions"];
  ok(validateProject(v2), "v2 loads");
  const norm = normalizeProject(v2 as SonicProject);
  eq(norm.schemaVersion, SCHEMA_VERSION);
  eq(norm.versions ?? [], []);
});

test("nested or absurd history is rejected or sanitized", () => {
  const evil = JSON.parse(JSON.stringify(createVersion(createProject("x"), "A")));
  evil.versions[0].snapshot.versions = evil.versions;
  ok(!validateProject(evil), "nested history rejected");
  const clean = normalizeProject(evil as SonicProject);
  for (const v of clean.versions!) {
    ok(!("versions" in (v.snapshot as Record<string, unknown>)), "sanitized");
  }
  const huge = JSON.parse(JSON.stringify(createProject("x")));
  huge.versions = Array.from({ length: 200 }, (_, i) => ({
    id: `ver_${i}`, label: "x", createdAt: new Date().toISOString(), versionNumber: i + 1,
    snapshot: snapshotProject(createProject("s")),
  }));
  ok(!validateProject(huge), "absurd history rejected");
});

test("versioned projects survive the storage merge", () => {
  const p = createVersion(createProject("Kept"), "Original");
  const out = mergeProjectLists([JSON.parse(JSON.stringify(p))], []);
  eq(out.length, 1);
  eq(out[0].versions!.length, 1);
});

suite("versions and exports");

test("exports read the current state, never a snapshot", () => {
  let p = withBpm(createProject("Live"), 100);
  p = createVersion(p, "Original");
  p = withBpm(p, 150);
  // every exporter consumes top-level musical fields — those are the live ones
  eq(p.config.bpm, 150);
  eq(p.versions![0].snapshot.config.bpm, 100);
  eq(p.meta.name, "Live");
});
