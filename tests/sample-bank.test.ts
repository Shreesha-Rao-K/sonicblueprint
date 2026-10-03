// Unit tests: sample bank registry, manifests, picking, cache, fallback.
import { suite, test, eq, ok } from "./helpers";
import {
  SampleBankCache,
  bankAttack,
  bankRelease,
  pickLayerVoices,
  pickSample,
  selectDrumHit,
  shiftSemitones,
  validateBankDef,
  type BankLoader,
} from "@/lib/sample-bank";
import {
  SAMPLE_BANKS,
  bankForSlot,
  banksForProject,
} from "@/lib/sample-manifest";
import { INSTRUMENT_DEFS } from "@/data/styles";

const PIANO = SAMPLE_BANKS["grand-piano"];

function fakeLoader(): BankLoader & { counter: { calls: number } } {
  const counter = { calls: 0 };
  return {
    counter,
    fetch: async () => new ArrayBuffer(8),
    decode: async () => {
      counter.calls++;
      return { duration: 2 };
    },
  };
}

suite("sample manifests");

test("bundled banks validate", () => {
  for (const [id, def] of Object.entries(SAMPLE_BANKS)) {
    ok(validateBankDef(def), id);
    eq(def.id, id);
  }
});

test("malformed manifests are rejected", () => {
  ok(!validateBankDef(null));
  ok(!validateBankDef({}));
  ok(!validateBankDef({ ...PIANO, notes: [] }));
  ok(!validateBankDef({ ...PIANO, notes: [{ midi: 60 }] }));
  ok(!validateBankDef({ ...PIANO, notes: [{ midi: 60, url: "a" }, { midi: 60, url: "b" }] }));
  ok(!validateBankDef({ ...PIANO, notes: [{ midi: 200, url: "a" }] }));
  ok(!validateBankDef({ ...PIANO, notes: [{ midi: "C4", url: "a" }] }));
  // unsorted
  ok(!validateBankDef({
    ...PIANO,
    notes: [{ midi: 64, url: "a" }, { midi: 60, url: "b" }],
  }));
  ok(!validateBankDef({ ...PIANO, attack: -1 }));
  const drums = SAMPLE_BANKS["acoustic-drums"];
  ok(!validateBankDef({ ...drums, rows: {} as never }));
  ok(!validateBankDef({ ...drums, rows: { kick: [] } }));
});

test("sampled defs reference real banks", () => {
  const sampled = INSTRUMENT_DEFS.filter((d) => d.sampleBank);
  ok(sampled.length >= 8, `sampled defs: ${sampled.length}`);
  for (const d of sampled) {
    ok(SAMPLE_BANKS[d.sampleBank!], `${d.name} -> ${d.sampleBank}`);
  }
});

test("new winds/horn/harp banks validate with full coverage", () => {
  for (const id of ["french-horn", "flute", "clarinet", "harp"]) {
    ok(validateBankDef(SAMPLE_BANKS[id]), `${id} validates`);
  }
  // single mf layer = gain-only velocity (documented, not faked)
  for (const id of ["flute", "clarinet", "harp", "french-horn"]) {
    for (const n of SAMPLE_BANKS[id].notes) {
      eq(n.layers.length, 1);
      eq(n.layers[0].minVel, 0);
    }
  }
});

suite("sample picking");

test("nearest sample within shift wins, far notes fall back", () => {
  // piano recorded every minor 3rd: C4=60, Eb4=63
  eq(pickSample(PIANO, 60)!.midi, 60);
  eq(pickSample(PIANO, 61)!.midi, 60);
  eq(pickSample(PIANO, 62)!.midi, 63);
  eq(pickSample(PIANO, 10), null);
  eq(pickSample(PIANO, 120), null);
  eq(pickSample(PIANO, NaN), null);
});

test("shift stays within the multisample promise", () => {
  const hit = pickSample(PIANO, 62)!;
  const shift = shiftSemitones(hit.midi, 62);
  ok(Math.abs(shift) <= 2, `shift ${shift}`);
});

test("drum groups follow velocity", () => {
  const groups = [
    { minVel: 0, urls: ["soft"] },
    { minVel: 0.45, urls: ["med"] },
    { minVel: 0.75, urls: ["loud"] },
  ];
  eq(selectDrumHit(groups, 0.1, 0)!, { group: 0, variation: 0 });
  eq(selectDrumHit(groups, 0.5, 0)!, { group: 1, variation: 0 });
  eq(selectDrumHit(groups, 0.9, 0)!, { group: 2, variation: 0 });
  eq(selectDrumHit([], 0.9, 0), null);
  eq(selectDrumHit([{ minVel: 0, urls: [] }], 0.5, 0), null);
});

suite("drum round-robin");

test("repeated hits cycle takes deterministically", () => {
  const groups = [{ minVel: 0, urls: ["a", "b", "c"] }];
  const seq = [0, 1, 2, 3, 4, 5].map((rr) => selectDrumHit(groups, 0.8, rr)!.variation);
  eq(seq, [0, 1, 2, 0, 1, 2]);
  // same inputs, same outputs — twice (realtime/offline parity)
  eq(seq, [0, 1, 2, 3, 4, 5].map((rr) => selectDrumHit(groups, 0.8, rr)!.variation));
});

test("round-robin stays inside the velocity group", () => {
  const groups = [
    { minVel: 0, urls: ["soft-a", "soft-b"] },
    { minVel: 0.75, urls: ["loud-a", "loud-b"] },
  ];
  for (let rr = 0; rr < 6; rr++) {
    const soft = selectDrumHit(groups, 0.2, rr)!;
    eq(soft.group, 0);
    eq(soft.variation, rr % 2);
    const loud = selectDrumHit(groups, 0.9, rr)!;
    eq(loud.group, 1);
    eq(loud.variation, rr % 2);
  }
});

test("single-take rows always resolve variation 0", () => {
  const groups = [{ minVel: 0, urls: ["only"] }];
  for (const rr of [0, 1, 7, 100]) {
    eq(selectDrumHit(groups, 0.5, rr)!, { group: 0, variation: 0 });
  }
});

test("occurrence is sanitized, never escaping the row", () => {
  const groups = [{ minVel: 0, urls: ["a", "b"] }];
  eq(selectDrumHit(groups, 0.5, -3)!.variation, 0);
  eq(selectDrumHit(groups, 0.5, NaN)!.variation, 0);
  eq(selectDrumHit(groups, 0.5, 2.7)!.variation, 0);
});

test("bundled drum rows validate with grouped takes", () => {
  const drums = SAMPLE_BANKS["acoustic-drums"];
  ok(validateBankDef(drums), "drums validate");
  for (const groups of Object.values(drums.rows!)) {
    ok(groups.length >= 1, "row has groups");
    ok(groups[0].minVel === 0, "coverage from 0");
    for (const g of groups) ok(g.urls.length >= 2, "round-robin takes present");
  }
});

test("malformed drum rows are rejected", () => {
  const drums = SAMPLE_BANKS["acoustic-drums"];
  const bad = (rows: unknown) =>
    validateBankDef({ ...drums, rows });
  ok(!bad({}), "empty rows rejected");
  ok(!bad({ kick: [] }), "empty groups rejected");
  ok(!bad({ kick: [{ minVel: 0, urls: [] }] }), "empty urls rejected");
  ok(!bad({ kick: [{ minVel: 0.2, urls: ["a"] }] }), "gap at 0 rejected");
  ok(!bad({ kick: [{ minVel: 0, urls: ["a"] }, { minVel: 0.4, urls: ["b"] }, { minVel: 0.3, urls: ["c"] }] }), "unsorted rejected");
  ok(!bad({ kick: [{ minVel: 0, urls: [""] }] }), "empty url rejected");
});

test("build assigns per-row occurrence counters", async () => {
  const { buildSongEvents } = await import("@/lib/audio-engine");
  const { createProject } = await import("@/lib/project-schema");
  const s = buildSongEvents(createProject("RR"));
  const kicks = s.drums.filter((d) => d.row === "kick");
  ok(kicks.length > 1, "several kicks");
  eq(kicks.map((d) => d.rr), kicks.map((_, i) => i));
  // identical rebuild (realtime vs offline share events): same counters
  const s2 = buildSongEvents(createProject("RR-other-name"));
  eq(
    s.drums.map((d) => `${d.row}:${d.rr}`),
    s2.drums.map((d) => `${d.row}:${d.rr}`)
  );
});

suite("pitched velocity layers");

test("layer manifests require full ascending coverage from 0", () => {
  ok(validateBankDef(SAMPLE_BANKS["grand-piano"]), "piano layered");
  ok(validateBankDef(SAMPLE_BANKS["violin-ensemble"]), "violin layered");
  ok(validateBankDef(SAMPLE_BANKS["cello"]), "cello layered");
  ok(validateBankDef(SAMPLE_BANKS["trumpet"]), "trumpet layered");
  // first layer must start at 0
  ok(!validateBankDef({
    ...SAMPLE_BANKS["grand-piano"],
    notes: [{ midi: 60, layers: [{ minVel: 0.2, url: "a" }] }],
  }), "gap at bottom rejected");
  // unsorted minVel rejected
  ok(!validateBankDef({
    ...SAMPLE_BANKS["grand-piano"],
    notes: [{ midi: 60, layers: [{ minVel: 0, url: "a" }, { minVel: 0.4, url: "b" }, { minVel: 0.3, url: "c" }] }],
  }), "unsorted rejected");
  // empty layers rejected
  ok(!validateBankDef({
    ...SAMPLE_BANKS["grand-piano"],
    notes: [{ midi: 60, layers: [] }],
  }), "empty rejected");
});

test("selection follows velocity with exact boundaries", () => {
  const layers = [
    { minVel: 0, url: "soft" },
    { minVel: 0.45, url: "med" },
    { minVel: 0.75, url: "loud" },
  ];
  eq(pickLayerVoices(layers, 0), [{ layer: 0, weight: 1 }]);
  eq(pickLayerVoices(layers, 0.2), [{ layer: 0, weight: 1 }]);
  // deep inside med: single voice
  eq(pickLayerVoices(layers, 0.6), [{ layer: 1, weight: 1 }]);
  // exactly on a boundary: full upper layer (continuous with above)
  eq(pickLayerVoices(layers, 0.75), [{ layer: 2, weight: 1 }]);
  eq(pickLayerVoices(layers, 1), [{ layer: 2, weight: 1 }]);
  // clamped out-of-range input
  eq(pickLayerVoices(layers, 5), [{ layer: 2, weight: 1 }]);
  eq(pickLayerVoices(layers, NaN).length, 1);
});

test("crossfade band blends neighbors with weights summing to 1", () => {
  const layers = [
    { minVel: 0, url: "soft" },
    { minVel: 0.5, url: "loud" },
  ];
  // band is [0.44, 0.5): midpoint blends evenly
  const mid = pickLayerVoices(layers, 0.47);
  eq(mid.length, 2);
  eq(mid[0].layer, 0);
  eq(mid[1].layer, 1);
  const sum = mid[0].weight + mid[1].weight;
  ok(Math.abs(sum - 1) < 1e-9, `weights sum to 1 (got ${sum})`);
  ok(mid[0].weight > 0.3 && mid[0].weight < 0.7, "near-even blend");
  // just below the band: pure lower; at boundary: pure upper
  eq(pickLayerVoices(layers, 0.43), [{ layer: 0, weight: 1 }]);
  eq(pickLayerVoices(layers, 0.5), [{ layer: 1, weight: 1 }]);
});

test("single-layer banks behave as before", () => {
  const one = [{ minVel: 0, url: "only" }];
  eq(pickLayerVoices(one, 0), [{ layer: 0, weight: 1 }]);
  eq(pickLayerVoices(one, 0.99), [{ layer: 0, weight: 1 }]);
  eq(pickLayerVoices([], 0.5), []);
});

test("bank envelope defaults are sane", () => {
  ok(bankAttack(PIANO) >= 0 && bankAttack(PIANO) < 0.1, "fast attack");
  ok(bankRelease(PIANO) > 0.3, "piano rings");
  ok(bankRelease(SAMPLE_BANKS["trumpet"]) < bankRelease(PIANO), "staccato shorter");
});

suite("bank cache");

test("loads decode once and reuse the same bank", async () => {
  const cache = new SampleBankCache();
  const loader = fakeLoader();
  const a = await cache.load(PIANO, loader);
  const b = await cache.load(PIANO, loader);
  ok(a === b, "same instance");
  eq(a.buffers.size, PIANO.notes.length);
  ok(cache.has("grand-piano"), "tracked");
});

test("concurrent loads share one fetch", async () => {
  const cache = new SampleBankCache();
  const loader = fakeLoader();
  const [a, b] = await Promise.all([cache.load(PIANO, loader), cache.load(PIANO, loader)]);
  ok(a === b, "shared inflight");
  eq(loader.counter.calls, PIANO.notes.length * PIANO.notes[0].layers.length);
});

test("failed loads never poison the cache", async () => {
  const cache = new SampleBankCache();
  const bad: BankLoader = {
    fetch: async () => { throw new Error("net down"); },
    decode: async () => ({ duration: 1 }),
  };
  let threw = false;
  try {
    await cache.load(PIANO, bad);
  } catch {
    threw = true;
  }
  ok(threw, "surfaces");
  ok(!cache.has("grand-piano"), "not cached");
});

test("header-only stub files degrade to null takes, never crash", async () => {
  // Regression for the two bundled snare_soft stubs (header-only MP3s the
  // decoder rejects): per-file tolerance must keep the bank usable, with the
  // dead takes resolving to null so synthesis covers them.
  const cache = new SampleBankCache();
  const stubLoader: BankLoader = {
    fetch: async (url: string) => {
      if (url.includes("soft")) throw new Error("Unable to decode audio data");
      return new ArrayBuffer(8);
    },
    decode: async () => ({ duration: 1 }),
  };
  const def = {
    ...SAMPLE_BANKS["acoustic-drums"],
    id: "stub-drums",
    rows: {
      snare: [
        { minVel: 0, urls: ["/samples/drums/snare_soft.mp3", "/samples/drums/snare_soft2.mp3"] },
        { minVel: 0.75, urls: ["/samples/drums/snare_loud.mp3"] },
      ],
    },
  };
  const bank = await cache.load(def, stubLoader);
  const takes = bank.drumBuffers.get("snare")!;
  eq(takes[0], [null, null]);
  ok(takes[1][0] !== null, "healthy take survives");
});

test("clear drops everything for disposal", async () => {
  const cache = new SampleBankCache();
  await cache.load(PIANO, fakeLoader());
  cache.clear();
  eq(cache.ids().length, 0);
  ok(!cache.has("grand-piano"), "gone");
});

suite("slot resolution");

test("sampled slots resolve, synth slots stay null", () => {
  eq(bankForSlot("piano", "Grand Piano"), "grand-piano");
  eq(bankForSlot("piano", "Bright Upright"), "grand-piano");
  eq(bankForSlot("strings", "String Ensemble"), "violin-ensemble");
  eq(bankForSlot("strings", "Solo Cello"), "cello");
  eq(bankForSlot("brass", "Brass Stabs"), "trumpet");
  eq(bankForSlot("brass", "French Horn"), "french-horn");
  eq(bankForSlot("winds", "Flute"), "flute");
  eq(bankForSlot("winds", "Clarinet"), "clarinet");
  eq(bankForSlot("plucks", "Harp"), "harp");
  eq(bankForSlot("synth", "Analog Saw"), null);
  eq(bankForSlot("guitar", "Nylon Guitar"), null);
  eq(bankForSlot("nope", "Nope"), null);
});

test("built events carry sample tags only for sampled slots", async () => {
  const { buildSongEvents } = await import("@/lib/audio-engine");
  const { createProject } = await import("@/lib/project-schema");
  const p = createProject("Tag");
  const s = buildSongEvents(p);
  // Default project: Grand Piano (sampled) + Warm Pad (synth) + strings (disabled)
  const pianoNotes = s.notes.filter((n) => n.synth === "piano");
  ok(pianoNotes.length > 0, "piano notes exist");
  for (const n of pianoNotes) eq(n.sample, "grand-piano");
  const padNotes = s.notes.filter((n) => n.synth === "pad");
  ok(padNotes.length > 0, "pad notes exist");
  for (const n of padNotes) eq(n.sample, undefined);
});

test("layer gating applies before sampling (muted layers emit nothing)", async () => {
  const { buildSongEvents } = await import("@/lib/audio-engine");
  const { createProject } = await import("@/lib/project-schema");
  const p = createProject("Gate");
  const off = buildSongEvents({ ...p, layers: { chords: false, drums: false, bass: false, melody: false } });
  eq(off.notes.length, 0);
  eq(off.drums.length, 0);
});

test("sampled slots survive save/reload with tags intact", async () => {
  const { buildSongEvents } = await import("@/lib/audio-engine");
  const { createProject, normalizeProject, validateProject } = await import("@/lib/project-schema");
  const p = createProject("Keep");
  const back = normalizeProject(JSON.parse(JSON.stringify(p)));
  ok(validateProject(back), "round trip validates");
  const before = buildSongEvents(p).notes.filter((n) => n.sample === "grand-piano").length;
  const after = buildSongEvents(back).notes.filter((n) => n.sample === "grand-piano").length;
  ok(before > 0, "piano tagged before save");
  eq(after, before);
});

suite("sample scheduling semantics");

type Rec = { kind: string; [k: string]: unknown };

function fakeCtx() {
  const recs: Rec[] = [];
  const mkParam = (v: number) => ({
    value: v,
    calls: [] as [string, ...number[]][],
    setValueAtTime(val: number, t: number) { this.calls.push(["set", val, t]); },
    linearRampToValueAtTime(val: number, t: number) { this.calls.push(["lin", val, t]); },
    exponentialRampToValueAtTime(val: number, t: number) { this.calls.push(["exp", val, t]); },
  });
  const mkGain = () => {
    const g = { gain: mkParam(0), connect: (d: unknown) => { recs.push({ kind: "connect", to: (d as { __tag?: string }).__tag ?? "node" }); } };
    (g as { __tag?: string }).__tag = "gain";
    return g;
  };
  const ctx = {
    currentTime: 5,
    destination: { __tag: "dest" },
    createBufferSource: () => {
      const s = {
        buffer: null as unknown,
        playbackRate: { value: 0 },
        connect: (d: unknown) => { recs.push({ kind: "src-connect" }); void d; },
        start: (t: number) => { recs.push({ kind: "start", t }); },
        stop: (t: number) => { recs.push({ kind: "stop", t }); },
      };
      recs.push({ kind: "source" });
      return s;
    },
    createGain: mkGain,
    createStereoPanner: () => {
      const p = { pan: { value: 0 }, connect: (d: unknown) => { recs.push({ kind: "pan-connect" }); void d; } };
      (p as { __tag?: string }).__tag = "pan";
      return p;
    },
    createBuffer: (ch: number, len: number) => ({
      numberOfChannels: ch,
      getChannelData: () => new Float32Array(len),
    }),
    createConvolver: () => ({ buffer: null as unknown, connect: (d: unknown) => { recs.push({ kind: "conv-connect" }); void d; } }),
  };
  return { ctx, recs, mkGain };
}

test("sampled voice schedules enveloped, rate-shifted playback", async () => {
  const { playSampleVoice } = await import("@/lib/audio-engine");
  const { ctx, recs } = fakeCtx();
  const buf = { duration: 4 } as unknown as AudioBuffer;
  playSampleVoice({
    ctx: ctx as never, dry: { __tag: "master" } as never, buf, when: 5,
    shift: 1, dur: 2, vol: 0.7, pan: 0.3, attack: 0.01, release: 0.4, roomLevel: 0.2,
  });
  const kinds = recs.map((r) => r.kind);
  ok(kinds.includes("source"), "source created");
  ok(kinds.includes("start") && kinds.includes("stop"), "bounded start/stop");
  const start = recs.find((r) => r.kind === "start")!;
  const stop = recs.find((r) => r.kind === "stop")!;
  ok((stop.t as number) > (start.t as number), "stop after start");
  ok(kinds.includes("pan-connect"), "panned when pan != 0");
  ok(kinds.includes("conv-connect"), "room send connected");
});

test("mono center voice skips panner but keeps room", async () => {
  const { playSampleVoice } = await import("@/lib/audio-engine");
  const { ctx, recs } = fakeCtx();
  playSampleVoice({
    ctx: ctx as never, dry: {} as never, buf: { duration: 4 } as unknown as AudioBuffer,
    when: 0, shift: -2, dur: 1, vol: 0.5, pan: 0, attack: 0.005, release: 0.2, roomLevel: 0,
  });
  const kinds = recs.map((r) => r.kind);
  ok(!kinds.includes("pan-connect"), "no panner at center");
  ok(!kinds.includes("conv-connect"), "no room at level 0");
});

test("sampledNoteVoices resolves loaded banks and nulls otherwise", async () => {
  const { sampledNoteVoices, sampledDrum } = await import("@/lib/audio-engine");
  // nothing loaded in node: everything falls back (never throws)
  eq(sampledNoteVoices("grand-piano", 60, 0.8), null);
  eq(sampledNoteVoices("nope", 60, 0.8), null);
  eq(sampledDrum("kick", 0.9), null);
  eq(sampledDrum("hihat", 0.9), null);
});

test("layered resolution is deterministic (realtime/offline parity)", async () => {
  // Both render paths call pickLayerVoices with the same inputs: agreement
  // here is what guarantees identical realtime and export behavior.
  const { pickLayerVoices } = await import("@/lib/sample-bank");
  const { SAMPLE_BANKS } = await import("@/lib/sample-manifest");
  for (const id of ["grand-piano", "violin-ensemble", "cello", "trumpet"]) {
    const layers = SAMPLE_BANKS[id].notes[4].layers;
    for (const vel of [0, 0.2, 0.44, 0.45, 0.5, 0.74, 0.75, 0.9, 1]) {
      const a = JSON.stringify(pickLayerVoices(layers, vel));
      const b = JSON.stringify(pickLayerVoices(layers, vel));
      eq(a, b, `${id} vel ${vel}`);
      const voices = JSON.parse(a) as { layer: number; weight: number }[];
      ok(voices.length >= 1 && voices.length <= 2, "1-2 voices");
      const sum = voices.reduce((s, v) => s + v.weight, 0);
      ok(Math.abs(sum - 1) < 1e-9, "weights sum to 1");
      for (const v of voices) {
        ok(v.layer >= 0 && v.layer < layers.length, "layer in range");
      }
    }
  }
});

test("missing decoded layers fall back to surviving ones", async () => {
  // A bank where only the soft layer decoded: loud velocities still sound.
  const { SampleBankCache } = await import("@/lib/sample-bank");
  const { SAMPLE_BANKS } = await import("@/lib/sample-manifest");
  const def = SAMPLE_BANKS["trumpet"];
  const cache = new SampleBankCache();
  let n = 0;
  await cache.load(def, {
    fetch: async (url: string) => {
      n++;
      // fail every non-soft file
      if (!url.includes("/soft/")) throw new Error("lost");
      return new ArrayBuffer(8);
    },
    decode: async () => ({ duration: 1 }),
  });
  const bank = cache.get("trumpet")!;
  const bufs = bank.buffers.get(def.notes[3].midi)!;
  eq(bufs.filter((b) => b !== null).length, 1);
  ok(n > def.notes.length, "attempted all layers");
});

test("ensureSampleBanks reports failures instead of throwing", async () => {
  const { ensureSampleBanks } = await import("@/lib/audio-engine");
  const badCtx = {
    decodeAudioData: async () => { throw new Error("nope"); },
  };
  const r = await ensureSampleBanks(["grand-piano", "acoustic-drums", "unknown-id"], badCtx as never);
  eq(r.failed.sort(), ["acoustic-drums", "grand-piano"]);
});

test("preload collects only enabled sampled slots", () => {
  const ids = banksForProject([
    { group: "piano", name: "Grand Piano", enabled: true },
    { group: "synth", name: "Analog Saw", enabled: true },
    { group: "strings", name: "String Ensemble", enabled: false },
  ]);
  eq(ids, ["grand-piano"]);
});

type CtxRec = { kind: string };

function fakeMixCtx() {
  const recs: CtxRec[] = [];
  const mkGain = () => {
    const g = {
      gain: { value: 1 },
      connect: (d: unknown) => { recs.push({ kind: "connect" }); void d; },
    };
    (g as { __tag?: string }).__tag = "gain";
    return g;
  };
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    destination: { __tag: "dest" },
    createGain: () => mkGain(),
    createWaveShaper: () => {
      const s = {
        curve: null as Float32Array | null,
        oversample: "none" as OverSampleType,
        connect: (d: unknown) => { recs.push({ kind: "shaper-connect" }); void d; },
      };
      recs.push({ kind: "shaper" });
      return s;
    },
    createConvolver: () => {
      const c = {
        buffer: null as unknown,
        connect: (d: unknown) => { recs.push({ kind: "conv-connect" }); void d; },
      };
      recs.push({ kind: "convolver" });
      return c;
    },
    createBuffer: (ch: number, len: number) => ({
      numberOfChannels: ch,
      getChannelData: () => new Float32Array(len),
    }),
  };
  return { ctx, recs };
}

test("ceiling is bit-transparent below 0.9 and bounded above", async () => {
  const { masterLimiter } = await import("@/lib/audio-engine");
  const { MASTER_CHAIN } = await import("@/lib/mix");
  const { ctx } = fakeMixCtx();
  const s = masterLimiter(ctx as never) as unknown as {
    curve: Float32Array;
    oversample: string;
  };
  ok(s.curve instanceof Float32Array, "real curve");
  eq(s.curve.length, MASTER_CHAIN.points);
  eq(s.oversample, "2x");
  // identity in the linear region (lookup helper mirrors Web Audio sampling)
  const at = (x: number) => {
    const i = Math.round(((x + 1) / 2) * (s.curve.length - 1));
    return s.curve[Math.max(0, Math.min(s.curve.length - 1, i))];
  };
  for (const x of [-0.9, -0.5, -0.1, 0, 0.1, 0.5, 0.9]) {
    ok(Math.abs(at(x) - x) < 0.002, `transparent at ${x}`);
  }
  // bounded + monotonic above
  let prev = at(0.9);
  for (let x = 0.9; x <= 1.0; x += 0.01) {
    const y = at(x);
    ok(y <= MASTER_CHAIN.ceiling + 1e-6, `bounded at ${x}`);
    ok(y >= prev - 1e-6, `monotonic at ${x}`);
    prev = y;
  }
  ok(at(1.5) <= MASTER_CHAIN.ceiling + 1e-6, "hard ceiling holds");
  // odd symmetry: no DC, no rectification
  ok(Math.abs(at(0.95) + at(-0.95)) < 0.004, "symmetric");
});

test("room bypass creates no nodes", async () => {
  const { roomSend } = await import("@/lib/audio-engine");
  const { ctx, recs } = fakeMixCtx();
  roomSend(ctx as never, {} as never, 0);
  roomSend(ctx as never, {} as never, -1);
  eq(recs.length, 0);
});

test("room bus is built once per context and shared", async () => {
  const { roomSend } = await import("@/lib/audio-engine");
  const { ctx, recs } = fakeMixCtx();
  const from = { connect: (d: unknown) => { recs.push({ kind: "from-connect" }); void d; } };
  roomSend(ctx as never, from as never, 0.1);
  roomSend(ctx as never, from as never, 0.2);
  eq(recs.filter((r) => r.kind === "convolver").length, 1);
  // a second context gets its own bus, never shared across contexts
  const other = fakeMixCtx();
  roomSend(other.ctx as never, from as never, 0.1);
  eq(other.recs.filter((r) => r.kind === "convolver").length, 1);
});

test("family sends are subtle and cover every synth", async () => {
  const { familyRoom, drumRoom, FAMILY_MIX, DRUM_SEND } = await import("@/lib/mix");
  for (const [synth, cfg] of Object.entries(FAMILY_MIX)) {
    ok(cfg.room >= 0 && cfg.room <= 0.2, `${synth} subtle (got ${cfg.room})`);
    eq(familyRoom(synth), cfg.room);
  }
  eq(familyRoom("bass"), 0);
  eq(familyRoom("unknown-synth"), 0);
  for (const [row, level] of Object.entries(DRUM_SEND)) {
    ok(level >= 0 && level <= 0.1, `${row} restrained`);
    eq(drumRoom(row), level);
  }
  eq(drumRoom("unknown-row"), 0);
});

test("mix switches compose the documented modes", async () => {
  const { MIX_ALL_ON, MIX_DRY, MIX_LEGACY } = await import("@/lib/mix");
  eq(MIX_ALL_ON, { sampleRoom: true, synthRoom: true, comp: true });
  eq(MIX_DRY, { sampleRoom: false, synthRoom: false, comp: false });
  eq(MIX_LEGACY, { sampleRoom: true, synthRoom: false, comp: false });
});

suite("articulation");

test("bank articulations match their recordings", async () => {
  const { SAMPLE_BANKS } = await import("@/lib/sample-manifest");
  eq(SAMPLE_BANKS["grand-piano"].articulation, "natural");
  eq(SAMPLE_BANKS["violin-ensemble"].articulation, "sustain-vibrato");
  eq(SAMPLE_BANKS["cello"].articulation, "sustain");
  eq(SAMPLE_BANKS["trumpet"].articulation, "staccato");
  eq(SAMPLE_BANKS["french-horn"].articulation, "sustain");
  eq(SAMPLE_BANKS["flute"].articulation, "sustain-vibrato");
  eq(SAMPLE_BANKS["clarinet"].articulation, "sustain");
  eq(SAMPLE_BANKS["harp"].articulation, "pluck");
  eq(SAMPLE_BANKS["acoustic-drums"].articulation, "hit");
});

test("invalid articulation metadata falls back safely", async () => {
  const { validateBankDef, articulatedDur, ARTICULATIONS } = await import("@/lib/sample-bank");
  const { SAMPLE_BANKS } = await import("@/lib/sample-manifest");
  ok(ARTICULATIONS.includes("staccato" as never), "known set");
  const bad = { ...SAMPLE_BANKS["trumpet"], articulation: "legato-magic" };
  ok(!validateBankDef(bad), "unknown articulation rejected");
  const missing = { ...SAMPLE_BANKS["trumpet"] } as Record<string, unknown>;
  delete missing["articulation"];
  ok(!validateBankDef(missing), "missing articulation rejected");
  // duration helper only shortens staccato
  const stac = SAMPLE_BANKS["trumpet"];
  eq(articulatedDur(stac, 4), 0.6);
  eq(articulatedDur(stac, 0.05), 0.08);
  eq(articulatedDur(SAMPLE_BANKS["grand-piano"], 4), 4);
  eq(articulatedDur(SAMPLE_BANKS["acoustic-drums"], 0.5), 0.5);
});

suite("velocity brightness");

test("brightness cutoff is conservative and bounded", async () => {
  const { brightnessCutoff } = await import("@/lib/audio-engine");
  eq(brightnessCutoff(1), null);
  eq(brightnessCutoff(5), null);
  eq(brightnessCutoff(NaN), null);
  const soft = brightnessCutoff(0)!;
  const mid = brightnessCutoff(0.6)!;
  ok(soft !== null && mid !== null, "shaped below full");
  ok(soft < mid, "quieter is mellower");
  ok(soft >= 1000 && mid <= 24000, "sane band");
});

suite("spatial profiles");

test("bass stays near center, others pass through", async () => {
  const { familyPanScale } = await import("@/lib/mix");
  eq(familyPanScale("bass"), 0.3);
  eq(familyPanScale("piano"), 1);
  eq(familyPanScale("strings"), 1);
  eq(familyPanScale("winds" as never), 1);
  eq(familyPanScale("unknown" as never), 1);
});

suite("cache lifecycle");

test("unload drops one bank without touching others", async () => {
  const { SampleBankCache } = await import("@/lib/sample-bank");
  const { SAMPLE_BANKS } = await import("@/lib/sample-manifest");
  const cache = new SampleBankCache();
  const loader = {
    fetch: async () => new ArrayBuffer(8),
    decode: async () => ({ duration: 2 }),
  };
  await cache.load(SAMPLE_BANKS["grand-piano"], loader);
  await cache.load(SAMPLE_BANKS["trumpet"], loader);
  ok(cache.unload("grand-piano"), "removed");
  ok(!cache.has("grand-piano"), "gone");
  ok(cache.has("trumpet"), "others kept");
  ok(!cache.unload("grand-piano"), "second unload reports false");
});
