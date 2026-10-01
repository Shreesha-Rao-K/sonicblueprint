// Unit tests: local-first backup and recovery (shared backup lib + storage).
import { suite, test, eq, ok } from "./helpers";
import {
  backupProblem,
  describeBackup,
  parseBackupFile,
  planImport,
} from "@/lib/backup";
import { createProject, type SonicProject } from "@/lib/project-schema";
import { mergeProjectLists, saveProject } from "@/lib/storage";

function json(p: SonicProject): string {
  return JSON.stringify(JSON.parse(JSON.stringify(p)));
}

suite("backup file parsing");

test("invalid JSON is refused without throwing", () => {
  const r = parseBackupFile("{not valid json!!!");
  eq(r.status, "not-json");
  eq(r.projects.length, 0);
  ok(backupProblem(r) !== null, "has message");
});

test("empty files and empty arrays explain themselves", () => {
  for (const text of ["", "null", "[]", "{}"]) {
    const r = parseBackupFile(text);
    ok(r.projects.length === 0, text || "empty-string");
    ok(backupProblem(r) !== null, `${text || "empty-string"} has message`);
  }
});

test("malformed schema entries are counted, valid ones kept", () => {
  const good = JSON.parse(json(createProject("Good")));
  const r = parseBackupFile(JSON.stringify([good, { nonsense: true }, null, "x"]));
  eq(r.status, "ok");
  eq(r.projects.length, 1);
  eq(r.invalidCount, 3);
  eq(backupProblem(r), null);
});

test("all-invalid files are refused with a message", () => {
  const r = parseBackupFile(JSON.stringify([{ nope: 1 }]));
  eq(r.projects.length, 0);
  eq(r.invalidCount, 1);
  ok((backupProblem(r) ?? "").length > 0, "message");
});

test("newer-schema backups are flagged, never loaded", () => {
  const p = JSON.parse(json(createProject("Future"))) as Record<string, unknown>;
  p["schemaVersion"] = 999;
  const r = parseBackupFile(JSON.stringify(p));
  eq(r.projects.length, 0);
  eq(r.newerCount, 1);
  const msg = backupProblem(r) ?? "";
  ok(msg.includes("newer"), "mentions newer app");
});

test("single-project and collection backups both parse", () => {
  const a = createProject("Alpha");
  const b = createProject("Beta");
  const single = parseBackupFile(json(a));
  eq(single.projects.length, 1);
  eq(single.projects[0].meta.name, "Alpha");
  const multi = parseBackupFile(JSON.stringify([JSON.parse(json(a)), JSON.parse(json(b))]));
  eq(multi.projects.length, 2);
  ok(describeBackup(multi).includes("2 songs"), "describes collection");
  ok(describeBackup(single).includes("Alpha"), "describes single");
});

suite("backup import planning");

test("fresh ids import as-is, colliding ids become copies", () => {
  const a = createProject("A");
  const existing = new Set([a.meta.id]);
  const plan = planImport([a], existing);
  eq(plan.fresh.length, 0);
  eq(plan.copies.length, 1);
  ok(plan.copies[0].meta.id !== a.meta.id, "fresh id");
  ok(plan.copies[0].meta.name.includes("(restored)"), "marked as copy");
  // musical content identical
  eq(plan.copies[0].config.bpm, a.config.bpm);
  eq(plan.copies[0].chords.chords, a.chords.chords);
});

test("two copies of the same song each get unique ids", () => {
  const a = createProject("A");
  const plan = planImport([a, a], new Set([a.meta.id]));
  eq(plan.copies.length, 2);
  ok(plan.copies[0].meta.id !== plan.copies[1].meta.id, "unique");
});

test("unknown ids import untouched", () => {
  const a = createProject("A");
  const plan = planImport([a], new Set());
  eq(plan.fresh.length, 1);
  eq(plan.fresh[0].meta.id, a.meta.id);
});

suite("backup storage behavior");

test("empty stores list no projects", () => {
  eq(mergeProjectLists([], []), []);
});

test("saving without browser storage never throws", async () => {
  // Node has neither IndexedDB nor localStorage: every backend fails and
  // saveProject must swallow it so export flows keep working.
  await saveProject(createProject("Nowhere"));
  ok(true, "resolved");
});
