// Unit tests: master effects (Reverb, Delay, 3-Band EQ, Chorus, Flanger, Dynamics Compressor).
import { suite, test, eq, ok, approx } from "./helpers";
import {
  defaultMasterFx,
  getReverbImpulse,
  normalizeMasterFx,
  calculateAutoMakeupGain,
  applyMasterEffects,
} from "@/lib/audio-effects";
import {
  SCHEMA_VERSION,
  createProject,
  normalizeProject,
  validateProject,
  type SonicProject,
} from "@/lib/project-schema";

suite("master effects defaults and normalization");

test("default effects are completely bypassed for legacy neutral parity", () => {
  const fx = defaultMasterFx();
  eq(fx.reverb.enabled, false);
  eq(fx.delay.enabled, false);
  eq(fx.eq.enabled, false);
  eq(fx.eq.lowGain, 0);
  eq(fx.eq.midGain, 0);
  eq(fx.eq.highGain, 0);
  eq(fx.modulation.enabled, false);
  eq(fx.modulation.type, "chorus");
  eq(fx.compressor.enabled, false);
  eq(fx.compressor.threshold, -18);
  eq(fx.compressor.ratio, 4);
  eq(fx.compressor.autoMakeup, true);
});

test("normalizeMasterFx enforces strict parameter bounds and safety limits", () => {
  const raw = {
    reverb: { enabled: true, decay: 999, mix: 5, tone: 99999 },
    delay: { enabled: true, time: 99, feedback: 0.99, mix: -2 }, // feedback must be capped <= 0.85!
    eq: { enabled: true, lowGain: 50, midGain: -50, highGain: NaN },
    modulation: { enabled: true, type: "unknown", rate: 100, depth: -5, feedback: 0.99, mix: 10 },
    compressor: { enabled: true, threshold: 50, knee: -10, ratio: 99, attack: 5, release: -1, makeupGain: 100, autoMakeup: "yes" },
  };
  const norm = normalizeMasterFx(raw);
  eq(norm.reverb.decay, 5.0, "decay clamped to max 5.0s");
  eq(norm.reverb.mix, 1.0, "mix clamped to 1.0");
  eq(norm.reverb.tone, 12000, "tone clamped to 12kHz");

  eq(norm.delay.time, 1.0, "delay time clamped to 1.0s");
  ok(norm.delay.feedback <= 0.85, "CRITICAL: delay feedback clamped <= 0.85 for stability");
  eq(norm.delay.mix, 0.0, "delay mix clamped to min 0.0");

  eq(norm.eq.lowGain, 12, "EQ low gain clamped to +12dB");
  eq(norm.eq.midGain, -12, "EQ mid gain clamped to -12dB");
  eq(norm.eq.highGain, 0, "NaN gain falls back to default 0dB");

  eq(norm.modulation.type, "chorus", "unknown modulation type defaults to chorus");
  eq(norm.modulation.rate, 8.0, "modulation rate clamped to max 8Hz");
  eq(norm.modulation.depth, 0.0, "modulation depth clamped to min 0.0");
  ok(norm.modulation.feedback <= 0.85, "CRITICAL: modulation feedback capped <= 0.85");
  eq(norm.modulation.mix, 1.0, "modulation mix clamped to max 1.0");

  eq(norm.compressor.threshold, 0, "threshold clamped to max 0 dB");
  eq(norm.compressor.knee, 0, "knee clamped to min 0 dB");
  eq(norm.compressor.ratio, 20, "ratio clamped to max 20:1");
  eq(norm.compressor.attack, 0.1, "attack clamped to max 0.1s");
  eq(norm.compressor.release, 0.05, "release clamped to min 0.05s");
  eq(norm.compressor.makeupGain, 24, "makeup gain clamped to max 24dB");
  eq(norm.compressor.autoMakeup, true, "non-boolean autoMakeup falls back to default true");
});

test("normalizeMasterFx gracefully handles empty or non-object inputs", () => {
  const def = defaultMasterFx();
  eq(normalizeMasterFx(undefined), def);
  eq(normalizeMasterFx(null), def);
  eq(normalizeMasterFx("not an object"), def);
  eq(normalizeMasterFx({}), def);
});

suite("dynamics compressor auto makeup gain");

test("calculateAutoMakeupGain computes accurate crest-factor compensated make-up gain", () => {
  // Threshold >= 0 or Ratio <= 1 should yield 0 dB
  eq(calculateAutoMakeupGain(0, 4), 0);
  eq(calculateAutoMakeupGain(5, 4), 0);
  eq(calculateAutoMakeupGain(-18, 1), 0);

  // Threshold -18 dB, Ratio 4:1 -> -(-18) * (1 - 0.25) * 0.5 = 18 * 0.75 * 0.5 = 6.75 dB
  approx(calculateAutoMakeupGain(-18, 4), 6.75);

  // Threshold -24 dB, Ratio 8:1 -> -(-24) * (1 - 0.125) * 0.5 = 24 * 0.875 * 0.5 = 10.5 dB
  approx(calculateAutoMakeupGain(-24, 8), 10.5);

  // Extreme compression clamped to 24 dB ceiling
  eq(calculateAutoMakeupGain(-60, 20), 24);
});

suite("reverb impulse response generation");

function createMockAudioContext(sampleRate = 44100): BaseAudioContext {
  const mockParam = (init = 0) => ({
    value: init,
    setValueAtTime: () => {},
    exponentialRampToValueAtTime: () => {},
    linearRampToValueAtTime: () => {},
  });
  const mockNode = () => ({
    connect: () => {},
    disconnect: () => {},
  });

  return {
    sampleRate,
    currentTime: 0,
    createGain: () => ({ ...mockNode(), gain: mockParam(1) }),
    createDelay: () => ({ ...mockNode(), delayTime: mockParam(0) }),
    createBiquadFilter: () => ({
      ...mockNode(),
      type: "lowpass",
      frequency: mockParam(1000),
      gain: mockParam(0),
      Q: mockParam(1),
    }),
    createOscillator: () => ({
      ...mockNode(),
      type: "sine",
      frequency: mockParam(1.2),
      start: () => {},
      stop: () => {},
    }),
    createConvolver: () => ({ ...mockNode(), buffer: null }),
    createChannelSplitter: (numberOfOutputs = 2) => ({ ...mockNode(), numberOfOutputs }),
    createChannelMerger: (numberOfInputs = 2) => ({ ...mockNode(), numberOfInputs }),
    createDynamicsCompressor: () => ({
      ...mockNode(),
      threshold: mockParam(-18),
      knee: mockParam(12),
      ratio: mockParam(4),
      attack: mockParam(0.01),
      release: mockParam(0.25),
      reduction: 0,
    }),
    createBuffer(channels: number, length: number, sr: number) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return {
        numberOfChannels: channels,
        length,
        sampleRate: sr,
        duration: length / sr,
        getChannelData(c: number) {
          return data[c];
        },
      } as AudioBuffer;
    },
  } as unknown as BaseAudioContext;
}

test("getReverbImpulse generates deterministic stereo impulse and caches by parameters", () => {
  const ctx = createMockAudioContext(44100);
  const ir1 = getReverbImpulse(ctx, 1.5, 4000);
  eq(ir1.numberOfChannels, 2);
  eq(ir1.sampleRate, 44100);
  approx(ir1.duration, 1.5, 0.01);

  // Re-fetch with same params returns exact cached reference
  const ir2 = getReverbImpulse(ctx, 1.5, 4000);
  ok(ir1 === ir2, "cached buffer instance returned");

  // Output is deterministic and non-silent
  const left = ir1.getChannelData(0);
  let nonZero = 0;
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== 0) nonZero++;
  }
  ok(nonZero > 100, "impulse has reverberant tail");
});

suite("audio graph wiring and live updates");

test("applyMasterEffects constructs full audio graph and updates without error", () => {
  const ctx = createMockAudioContext(44100);
  const input = ctx.createGain();
  const output = ctx.createGain();

  const handle = applyMasterEffects(ctx, input, output);
  ok(typeof handle.update === "function", "handle provides update function");
  ok(typeof handle.dispose === "function", "handle provides dispose function");

  // Enable chorus and compressor live
  handle.update({
    ...defaultMasterFx(),
    modulation: {
      enabled: true,
      type: "chorus",
      rate: 2.0,
      depth: 0.8,
      feedback: 0.3,
      mix: 0.5,
    },
    compressor: {
      enabled: true,
      threshold: -24,
      knee: 10,
      ratio: 8,
      attack: 0.02,
      release: 0.3,
      makeupGain: 3,
      autoMakeup: true,
    },
  });

  // Switch to flanger
  handle.update({
    ...defaultMasterFx(),
    modulation: {
      enabled: true,
      type: "flanger",
      rate: 0.5,
      depth: 0.9,
      feedback: 0.8,
      mix: 0.6,
    },
  });

  // Clean disposal
  handle.dispose();
});

suite("schema v5 migration and persistence");

test("schema version is 5 and projects validate with modulation and compressor", () => {
  eq(SCHEMA_VERSION, 5);
  const p = createProject("V5 Track");
  eq(p.schemaVersion, 5);
  ok(p.effects !== undefined, "effects field exists");
  eq(p.effects.reverb.enabled, false);
  eq(p.effects.modulation.enabled, false);
  eq(p.effects.compressor.enabled, false);
  ok(validateProject(p), "v5 project validates");
});

test("legacy v1, v2, v3, v4 projects migrate seamlessly to v5", () => {
  const base = createProject("Legacy Test") as unknown as Record<string, unknown>;

  // Test v4 -> v5 migration
  const v4Proj = { ...JSON.parse(JSON.stringify(base)), schemaVersion: 4 };
  delete v4Proj["effects"];
  ok(validateProject(v4Proj), "v4 project validates");
  const normV4 = normalizeProject(v4Proj as unknown as SonicProject);
  eq(normV4.schemaVersion, 5);
  eq(normV4.effects?.reverb.enabled, false);
  eq(normV4.effects?.modulation.enabled, false);
  eq(normV4.effects?.compressor.enabled, false);

  // Test v3 -> v5 migration
  const v3Proj = { ...JSON.parse(JSON.stringify(base)), schemaVersion: 3 };
  delete v3Proj["effects"];
  delete (v3Proj["config"] as Record<string, unknown>)["humanize"];
  ok(validateProject(v3Proj), "v3 project validates");
  const normV3 = normalizeProject(v3Proj as unknown as SonicProject);
  eq(normV3.schemaVersion, 5);
  eq(normV3.config.humanize, "subtle");
  eq(normV3.effects?.delay.enabled, false);

  // Test v2 -> v5 migration
  const v2Proj = { ...JSON.parse(JSON.stringify(base)), schemaVersion: 2 };
  delete v2Proj["effects"];
  delete v2Proj["versions"];
  delete (v2Proj["config"] as Record<string, unknown>)["humanize"];
  ok(validateProject(v2Proj), "v2 project validates");
  const normV2 = normalizeProject(v2Proj as unknown as SonicProject);
  eq(normV2.schemaVersion, 5);
  eq(normV2.versions?.length, 0);

  // Test v1 -> v5 migration
  const v1Proj = { ...JSON.parse(JSON.stringify(base)), schemaVersion: 1 };
  delete v1Proj["effects"];
  delete v1Proj["layers"];
  delete v1Proj["versions"];
  delete (v1Proj["config"] as Record<string, unknown>)["humanize"];
  ok(validateProject(v1Proj), "v1 project validates");
  const normV1 = normalizeProject(v1Proj as unknown as SonicProject);
  eq(normV1.schemaVersion, 5);
  eq(normV1.layers.chords, true);
});

test("malformed effects payloads are rejected by schema validator", () => {
  const p = createProject("Test");

  // Non-boolean enabled
  const bad1 = JSON.parse(JSON.stringify(p));
  bad1.effects.reverb.enabled = "yes";
  ok(!validateProject(bad1), "reject string enabled");

  // Non-finite decay
  const bad2 = JSON.parse(JSON.stringify(p));
  bad2.effects.reverb.decay = Infinity;
  ok(!validateProject(bad2), "reject Infinity decay");

  // Out of bounds EQ gain (> 24 dB)
  const bad3 = JSON.parse(JSON.stringify(p));
  bad3.effects.eq.lowGain = 999;
  ok(!validateProject(bad3), "reject absurd EQ gain");

  // Invalid modulation type
  const badMod = JSON.parse(JSON.stringify(p));
  badMod.effects.modulation.type = "phaser";
  ok(!validateProject(badMod), "reject unsupported modulation type");

  // Non-finite compressor threshold
  const badComp = JSON.parse(JSON.stringify(p));
  badComp.effects.compressor.threshold = NaN;
  ok(!validateProject(badComp), "reject NaN compressor threshold");
});
