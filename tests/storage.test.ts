// Tests: storage merge rules (pure mergeProjectLists — no browser APIs needed).
import { suite, test, eq, ok } from "./helpers.js";
import { createProject } from "@/lib/project-schema";
import { mergeProjectLists } from "@/lib/storage";

function named(name: string, updatedAt: string, id?: string) {
  const p = createProject(name);
  p.meta.updatedAt = updatedAt;
  if (id) p.meta.id = id;
  return JSON.parse(JSON.stringify(p));
}

suite("storage merge");

test("IndexedDB-only projects list newest-first", () => {
  const out = mergeProjectLists(
    [named("B", "2024-02-01T00:00:00.000Z"), named("A", "2024-01-01T00:00:00.000Z")],
    []
  );
  eq(out.map((p) => p.meta.name), ["B", "A"]);
});

test("localStorage-only projects are preserved", () => {
  const out = mergeProjectLists([], [named("Solo", "2024-03-01T00:00:00.000Z")]);
  eq(out.length, 1);
  eq(out[0].meta.name, "Solo");
});

test("mixed stores merge and sort consistently", () => {
  const out = mergeProjectLists(
    [named("IDB", "2024-01-01T00:00:00.000Z", "id-1")],
    [named("LS", "2024-06-01T00:00:00.000Z", "id-2")]
  );
  eq(out.map((p) => p.meta.name), ["LS", "IDB"]);
});

test("duplicate IDs prefer the IndexedDB copy", () => {
  const idb = named("FromIDB", "2024-01-01T00:00:00.000Z", "same-id");
  const ls = named("FromLS", "2024-12-01T00:00:00.000Z", "same-id");
  const out = mergeProjectLists([idb], [ls]);
  eq(out.length, 1);
  eq(out[0].meta.name, "FromIDB");
});

test("malformed entries are dropped, never crash", () => {
  const good = named("Good", "2024-01-01T00:00:00.000Z", "good-id");
  const out = mergeProjectLists(
    [null, 42, "nope", { schemaVersion: 99 }, good, []],
    ["{broken", undefined, { schemaVersion: 1 }]
  );
  eq(out.map((p) => p.meta.name), ["Good"]);
});

test("empty stores yield an empty list", () => {
  eq(mergeProjectLists([], []), []);
});

test("invalid entries cannot shadow valid ones", () => {
  const good = named("Good", "2024-01-01T00:00:00.000Z", "dup-id");
  const evil = { schemaVersion: 1, meta: { id: "dup-id" } };
  const out = mergeProjectLists([evil], [good]);
  eq(out.map((p) => p.meta.name), ["Good"]);
  ok(out.length === 1, "single entry");
});
