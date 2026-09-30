// Security tests: malformed and hostile project files must be rejected or
// rendered harmlessly — never crash, hang, or pollute prototypes.
import { suite, test, eq, ok } from "./helpers.js";
import { buildSongEvents } from "@/lib/audio-engine";
import { createProject, validateProject } from "@/lib/project-schema";

function base(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(createProject("Security")));
}

suite("validation rejects absurd files");

test("missing sections fail", () => {
  for (const key of ["chords", "drums", "bass", "instruments", "arrangement", "originality"]) {
    const p = base();
    delete p[key];
    ok(!validateProject(p), `missing ${key}`);
  }
});

test("render-critical strings are required", () => {
  const p1 = base();
  delete (p1["meta"] as Record<string, unknown>)["name"];
  ok(!validateProject(p1), "meta.name missing");
  const p2 = base();
  delete (p2["chords"] as Record<string, unknown>)["progressionId"];
  ok(!validateProject(p2), "progressionId missing");
  const p3 = base();
  delete (p3["drums"] as Record<string, unknown>)["patternId"];
  ok(!validateProject(p3), "patternId missing");
});

test("null sections fail", () => {
  for (const key of ["meta", "config", "chords", "drums", "bass", "originality"]) {
    const p = base();
    p[key] = null;
    ok(!validateProject(p), `null ${key}`);
  }
});

test("unbounded arrays fail", () => {
  const big = new Array(10_000).fill("C");
  const p1 = base();
  (p1["chords"] as Record<string, unknown>)["chords"] = big;
  ok(!validateProject(p1), "10k chords");
  const p1b = base();
  (p1b["chords"] as Record<string, unknown>)["chords"] = [];
  ok(!validateProject(p1b), "zero chords");
  const p2 = base();
  p2["instruments"] = new Array(10_000).fill({});
  ok(!validateProject(p2), "10k instruments");
  const p3 = base();
  p3["arrangement"] = new Array(10_000).fill({ name: "VERSE", bars: 4, energy: 5 });
  ok(!validateProject(p3), "10k sections");
});

test("absurd scalars fail", () => {
  const p1 = base();
  (p1["chords"] as Record<string, unknown>)["beatsPerChord"] = 1e9;
  ok(!validateProject(p1), "beatsPerChord 1e9");
  const p1b = base();
  delete (p1b["chords"] as Record<string, unknown>)["beatsPerChord"];
  ok(!validateProject(p1b), "beatsPerChord missing");
  const p1c = base();
  (p1c["chords"] as Record<string, unknown>)["chords"] = ["Dm", 42];
  ok(!validateProject(p1c), "non-string chord");
  const p2 = base();
  (p2["drums"] as Record<string, unknown>)["steps"] = 1e9;
  ok(!validateProject(p2), "steps 1e9");
  const p3 = base();
  (p3["arrangement"] as Array<Record<string, unknown>>)[0]["bars"] = 1e9;
  ok(!validateProject(p3), "bars 1e9");
  const p3b = base();
  delete (p3b["arrangement"] as Array<Record<string, unknown>>)[0]["name"];
  ok(!validateProject(p3b), "section without name");
  const p4 = base();
  (p4["originality"] as Record<string, unknown>)["melodySeed"] = "x".repeat(10_000);
  ok(!validateProject(p4), "10k seed");
});

suite("engine never hangs or crashes on hostile input");

test("clamped values render quickly", () => {
  const p = base();
  (p["chords"] as Record<string, unknown>)["beatsPerChord"] = 1e9;
  (p["drums"] as Record<string, unknown>)["steps"] = 1e9;
  (p["drums"] as Record<string, unknown>)["grid"] = { kick: [true] };
  (p as Record<string, unknown>)["bass"] = { styleId: "custom", octave: 1, volume: 1, pattern: new Array(1_000_000).fill(true) };
  const s = buildSongEvents(p as never);
  ok(Number.isFinite(s.duration) && s.duration > 0, "finite duration");
  ok(s.notes.length < 2_000_000 && s.drums.length < 2_000_000, "bounded output");
});

test("missing sub-objects fall back instead of throwing", () => {
  const p = base();
  delete p["chords"];
  delete p["drums"];
  delete p["bass"];
  delete (p as Record<string, unknown>)["instruments"];
  delete p["arrangement"];
  delete (p as Record<string, unknown>)["originality"];
  const s = buildSongEvents(p as never);
  ok(s.duration >= 0, "renders empty song");
});

suite("prototype pollution");

test("__proto__ keys in imported JSON stay inert", () => {
  const evil = JSON.parse(
    '{"schemaVersion":1,' +
      '"meta":{"id":"x","name":"Evil","__proto__":{"polluted":true}},' +
      '"config":{"bpm":100,"keyTonic":"C","scale":"major","timeSignature":"4/4","mood":"Dark","energy":5,"dynamics":5},' +
      '"chords":{"progressionId":"custom-evil","chords":["C"],"beatsPerChord":4,"octave":3},' +
      '"drums":{"patternId":"custom-evil","steps":16,' +
      '"grid":{"kick":[true],"__proto__":[true]},"swing":0,"velocity":1},' +
      '"bass":{"styleId":"root","octave":1,"volume":1},' +
      '"instruments":[],"arrangement":[],"originality":{"melodySeed":"s"}}'
  );
  ok(validateProject(evil), "hostile but well-formed shape validates");
  const s = buildSongEvents(evil as never);
  ok(s.notes.length >= 0, "renders");
  eq(({} as Record<string, unknown>)["polluted"], undefined);
  eq((Object.prototype as Record<string, unknown>)["polluted"], undefined);
});
