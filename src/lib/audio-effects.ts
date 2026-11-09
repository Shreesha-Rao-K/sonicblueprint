// ── Real-time & offline master effects (Reverb, Delay, 3-Band EQ) ──
// Shared architecture for interactive playback and offline rendering (WAV, MP3, stems).
// Designed for bit-transparent neutral bypass, strictly bounded parameters,
// stable delay feedback (hard safety ceiling 0.85), and deterministic impulse generation.

export interface ReverbConfig {
  enabled: boolean;
  decay: number; // seconds: 0.2..5.0 (default 1.5)
  mix: number; // 0.0..1.0 (default 0.3)
  tone: number; // lowpass cut Hz: 500..12000 (default 4000)
}

export interface DelayConfig {
  enabled: boolean;
  time: number; // seconds: 0.05..1.0 (default 0.25)
  feedback: number; // 0.0..0.85 (strict safety cap prevents runaway feedback)
  mix: number; // 0.0..1.0 (default 0.25)
}

export interface EqConfig {
  enabled: boolean;
  lowGain: number; // dB: -12..+12 (default 0)
  midGain: number; // dB: -12..+12 (default 0)
  highGain: number; // dB: -12..+12 (default 0)
}

export interface ModulationEffectParams {
  type: "chorus" | "flanger";
  rate: number; // 0.1 to 8.0 Hz (default: 1.2 Hz)
  depth: number; // 0.0 to 1.0 (default: 0.5)
  feedback: number; // 0.0 to 0.95 (clamped to safety ceiling 0.85)
  mix: number; // 0.0 to 1.0 (wet/dry, default: 0.5)
}

export interface ModulationConfig extends ModulationEffectParams {
  enabled: boolean; // default: false (neutral bypass)
}

export interface CompressorEffectParams {
  threshold: number; // -60 to 0 dB (default: -18 dB)
  ratio: number; // 1 to 20 (default: 4:1)
  attack: number; // 0.001 to 0.1 s (default: 0.010 s)
  release: number; // 0.05 to 1.0 s (default: 0.250 s)
  makeupGain: number; // 0 to 24 dB (default: 0 dB)
}

export interface CompressorConfig extends CompressorEffectParams {
  enabled: boolean; // default: false (neutral bypass)
  knee: number; // 0 to 40 dB (default: 12 dB)
  autoMakeup: boolean; // default: true
}

export interface MasterFxConfig {
  reverb: ReverbConfig;
  delay: DelayConfig;
  eq: EqConfig;
  modulation: ModulationConfig;
  compressor: CompressorConfig;
}

export function defaultMasterFx(): MasterFxConfig {
  return {
    reverb: {
      enabled: false,
      decay: 1.5,
      mix: 0.3,
      tone: 4000,
    },
    delay: {
      enabled: false,
      time: 0.25,
      feedback: 0.3,
      mix: 0.25,
    },
    eq: {
      enabled: false,
      lowGain: 0,
      midGain: 0,
      highGain: 0,
    },
    modulation: {
      enabled: false,
      type: "chorus",
      rate: 1.2,
      depth: 0.5,
      feedback: 0.2,
      mix: 0.5,
    },
    compressor: {
      enabled: false,
      threshold: -18,
      knee: 12,
      ratio: 4,
      attack: 0.01,
      release: 0.25,
      makeupGain: 0,
      autoMakeup: true,
    },
  };
}

function clamp(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}

/** Calculate studio crest-factor compensated auto makeup gain in dB. */
export function calculateAutoMakeupGain(threshold: number, ratio: number): number {
  if (ratio <= 1 || threshold >= 0) return 0;
  const rawMakeup = -threshold * (1 - 1 / ratio) * 0.5;
  return Math.max(0, Math.min(24, rawMakeup));
}

/** Sanitize and normalize effect configuration against missing or corrupt inputs. */
export function normalizeMasterFx(raw?: unknown): MasterFxConfig {
  const def = defaultMasterFx();
  if (typeof raw !== "object" || raw === null) return def;
  const r = raw as Record<string, unknown>;

  const rev = (r["reverb"] ?? {}) as Record<string, unknown>;
  const del = (r["delay"] ?? {}) as Record<string, unknown>;
  const eq = (r["eq"] ?? {}) as Record<string, unknown>;
  const mod = (r["modulation"] ?? {}) as Record<string, unknown>;
  const comp = (r["compressor"] ?? {}) as Record<string, unknown>;

  const modType = mod["type"] === "flanger" ? "flanger" : "chorus";

  return {
    reverb: {
      enabled: typeof rev["enabled"] === "boolean" ? rev["enabled"] : def.reverb.enabled,
      decay: clamp(rev["decay"], 0.2, 5.0, def.reverb.decay),
      mix: clamp(rev["mix"], 0.0, 1.0, def.reverb.mix),
      tone: clamp(rev["tone"], 500, 12000, def.reverb.tone),
    },
    delay: {
      enabled: typeof del["enabled"] === "boolean" ? del["enabled"] : def.delay.enabled,
      time: clamp(del["time"], 0.05, 1.0, def.delay.time),
      feedback: clamp(del["feedback"], 0.0, 0.85, def.delay.feedback), // Safety clamp <= 0.85
      mix: clamp(del["mix"], 0.0, 1.0, def.delay.mix),
    },
    eq: {
      enabled: typeof eq["enabled"] === "boolean" ? eq["enabled"] : def.eq.enabled,
      lowGain: clamp(eq["lowGain"], -12, 12, def.eq.lowGain),
      midGain: clamp(eq["midGain"], -12, 12, def.eq.midGain),
      highGain: clamp(eq["highGain"], -12, 12, def.eq.highGain),
    },
    modulation: {
      enabled: typeof mod["enabled"] === "boolean" ? mod["enabled"] : def.modulation.enabled,
      type: modType,
      rate: clamp(mod["rate"], 0.1, 8.0, def.modulation.rate),
      depth: clamp(mod["depth"], 0.0, 1.0, def.modulation.depth),
      feedback: clamp(mod["feedback"], 0.0, 0.85, def.modulation.feedback), // Safety cap <= 0.85
      mix: clamp(mod["mix"], 0.0, 1.0, def.modulation.mix),
    },
    compressor: {
      enabled: typeof comp["enabled"] === "boolean" ? comp["enabled"] : def.compressor.enabled,
      threshold: clamp(comp["threshold"], -60, 0, def.compressor.threshold),
      knee: clamp(comp["knee"], 0, 40, def.compressor.knee),
      ratio: clamp(comp["ratio"], 1, 20, def.compressor.ratio),
      attack: clamp(comp["attack"], 0.001, 0.1, def.compressor.attack),
      release: clamp(comp["release"], 0.05, 1.0, def.compressor.release),
      makeupGain: clamp(comp["makeupGain"], 0, 24, def.compressor.makeupGain),
      autoMakeup: typeof comp["autoMakeup"] === "boolean" ? comp["autoMakeup"] : def.compressor.autoMakeup,
    },
  };
}

// Cache generated reverb impulse responses to avoid reallocating on every song segment/note
const reverbImpulseCache = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();

/** Deterministic stereo impulse response with exponential decay and tone damping. */
export function getReverbImpulse(
  ctx: BaseAudioContext,
  decaySec: number,
  toneHz: number
): AudioBuffer {
  let ctxMap = reverbImpulseCache.get(ctx);
  if (!ctxMap) {
    ctxMap = new Map();
    reverbImpulseCache.set(ctx, ctxMap);
  }
  const key = `${decaySec.toFixed(2)}_${Math.round(toneHz)}`;
  const cached = ctxMap.get(key);
  if (cached) return cached;

  const sr = ctx.sampleRate || 44100;
  const len = Math.max(1, Math.floor(sr * decaySec));
  const ir = ctx.createBuffer(2, len, sr);

  // Deterministic PRNG (LCG with fixed seed) for 100% reproducible exports
  let seed = 0x4a7e3d1;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296 - 0.5;
  };

  const decayFactor = 3.0 / decaySec;
  // Tone damping coefficient: lower tone = more high-frequency absorption
  const damp = Math.max(0.1, Math.min(0.9, toneHz / 12000));

  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    let filterState = 0;
    for (let i = 0; i < len; i++) {
      const t = i / sr;
      const env = Math.exp(-t * decayFactor);
      const whiteNoise = rand() * 2;
      filterState = filterState * (1 - damp) + whiteNoise * damp;
      data[i] = filterState * env * 0.7;
    }
  }

  ctxMap.set(key, ir);
  return ir;
}

export interface MasterFxHandle {
  update: (fx: MasterFxConfig) => void;
  dispose: () => void;
}

/** Apply master effects chain between an input node and output node.
 * Supports live dynamic updates and offline rendering alike. */
export function applyMasterEffects(
  ctx: BaseAudioContext,
  input: AudioNode,
  output: AudioNode,
  initialFx?: MasterFxConfig
): MasterFxHandle {
  let currentFx = normalizeMasterFx(initialFx);

  // ── 1. Three-Band EQ ──
  const eqLow = ctx.createBiquadFilter();
  eqLow.type = "lowshelf";
  eqLow.frequency.value = 200;
  eqLow.gain.value = currentFx.eq.enabled ? currentFx.eq.lowGain : 0;

  const eqMid = ctx.createBiquadFilter();
  eqMid.type = "peaking";
  eqMid.frequency.value = 1000;
  eqMid.Q.value = 0.8;
  eqMid.gain.value = currentFx.eq.enabled ? currentFx.eq.midGain : 0;

  const eqHigh = ctx.createBiquadFilter();
  eqHigh.type = "highshelf";
  eqHigh.frequency.value = 4000;
  eqHigh.gain.value = currentFx.eq.enabled ? currentFx.eq.highGain : 0;

  input.connect(eqLow);
  eqLow.connect(eqMid);
  eqMid.connect(eqHigh);

  // ── 2. Stereo Modulation (Chorus & Flanger) ──
  const modInput = ctx.createGain();
  eqHigh.connect(modInput);

  const modDry = ctx.createGain();
  const modWet = ctx.createGain();
  const modOutput = ctx.createGain();

  // Defensive check for environments with channel splitter/merger support
  const hasSplitterMerger =
    typeof ctx.createChannelSplitter === "function" &&
    typeof ctx.createChannelMerger === "function";

  const modSplitter = hasSplitterMerger ? ctx.createChannelSplitter(2) : null;
  const modMerger = hasSplitterMerger ? ctx.createChannelMerger(2) : null;

  const delayL = ctx.createDelay(0.1);
  const delayR = ctx.createDelay(0.1);
  const filterL = ctx.createBiquadFilter();
  const filterR = ctx.createBiquadFilter();
  filterL.type = "lowpass";
  filterR.type = "lowpass";
  filterL.frequency.value = 8000;
  filterR.frequency.value = 8000;

  const feedbackL = ctx.createGain();
  const feedbackR = ctx.createGain();

  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = currentFx.modulation.rate;

  const depthGainL = ctx.createGain();
  const depthGainR = ctx.createGain();

  // Parameter calculation helper for modulation
  const getModParams = (cfg: ModulationConfig) => {
    const isFlanger = cfg.type === "flanger";
    const baseDelay = isFlanger ? 0.003 : 0.02; // 3ms vs 20ms
    const maxDepth = isFlanger ? 0.002 : 0.008; // 2ms excursion vs 8ms
    const excursion = maxDepth * cfg.depth;
    const fbScale = isFlanger ? cfg.feedback * 0.85 : cfg.feedback * 0.4;
    return { baseDelay, excursion, fbScale };
  };

  const initialMod = getModParams(currentFx.modulation);
  delayL.delayTime.value = initialMod.baseDelay;
  delayR.delayTime.value = initialMod.baseDelay;
  depthGainL.gain.value = currentFx.modulation.enabled ? initialMod.excursion : 0;
  depthGainR.gain.value = currentFx.modulation.enabled ? -initialMod.excursion : 0; // 180° anti-phase
  feedbackL.gain.value = currentFx.modulation.enabled ? initialMod.fbScale : 0;
  feedbackR.gain.value = currentFx.modulation.enabled ? initialMod.fbScale : 0;

  modDry.gain.value = currentFx.modulation.enabled ? 1.0 - currentFx.modulation.mix * 0.5 : 1.0;
  modWet.gain.value = currentFx.modulation.enabled ? currentFx.modulation.mix : 0.0;

  // LFO routing
  lfo.connect(depthGainL);
  lfo.connect(depthGainR);
  depthGainL.connect(delayL.delayTime);
  depthGainR.connect(delayR.delayTime);

  // Wire modulation path
  modInput.connect(modDry);
  modDry.connect(modOutput);

  if (modSplitter && modMerger) {
    modInput.connect(modSplitter);
    // Left channel
    modSplitter.connect(delayL, 0);
    delayL.connect(filterL);
    filterL.connect(feedbackL);
    feedbackL.connect(delayL);
    filterL.connect(modMerger, 0, 0);
    // Right channel
    modSplitter.connect(delayR, 1);
    delayR.connect(filterR);
    filterR.connect(feedbackR);
    feedbackR.connect(delayR);
    filterR.connect(modMerger, 0, 1);

    modMerger.connect(modWet);
  } else {
    // Fallback single-path routing
    modInput.connect(delayL);
    delayL.connect(filterL);
    filterL.connect(feedbackL);
    feedbackL.connect(delayL);
    filterL.connect(modWet);
  }
  modWet.connect(modOutput);

  // Start LFO immediately (vital for OfflineAudioContext rendering!)
  try {
    lfo.start(0);
  } catch {
    /* already started */
  }

  // ── 3. Stereo Delay ──
  const delayInput = ctx.createGain();
  modOutput.connect(delayInput);

  const delayDry = ctx.createGain();
  const delayWet = ctx.createGain();
  const delayNode = ctx.createDelay(1.0);
  const delayFeedback = ctx.createGain();
  const delayFilter = ctx.createBiquadFilter();
  delayFilter.type = "lowpass";
  delayFilter.frequency.value = 3500; // Warm analog character

  delayNode.delayTime.value = currentFx.delay.time;
  delayFeedback.gain.value = currentFx.delay.enabled ? currentFx.delay.feedback : 0;
  delayDry.gain.value = 1.0;
  delayWet.gain.value = currentFx.delay.enabled ? currentFx.delay.mix : 0;

  delayInput.connect(delayDry);
  delayInput.connect(delayNode);
  delayNode.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(delayNode); // Safe feedback loop capped <= 0.85
  delayFilter.connect(delayWet);

  const delayOutput = ctx.createGain();
  delayDry.connect(delayOutput);
  delayWet.connect(delayOutput);

  // ── 4. Master Reverb (Convolver) ──
  const reverbInput = ctx.createGain();
  delayOutput.connect(reverbInput);

  const reverbDry = ctx.createGain();
  const reverbWet = ctx.createGain();
  const convolver = ctx.createConvolver();
  const reverbFilter = ctx.createBiquadFilter();
  reverbFilter.type = "lowpass";
  reverbFilter.frequency.value = currentFx.reverb.tone;

  convolver.buffer = getReverbImpulse(ctx, currentFx.reverb.decay, currentFx.reverb.tone);
  reverbDry.gain.value = 1.0;
  reverbWet.gain.value = currentFx.reverb.enabled ? currentFx.reverb.mix : 0;

  reverbInput.connect(reverbDry);
  reverbInput.connect(convolver);
  convolver.connect(reverbFilter);
  reverbFilter.connect(reverbWet);

  const reverbOutput = ctx.createGain();
  reverbDry.connect(reverbOutput);
  reverbWet.connect(reverbOutput);

  // ── 5. Studio Dynamics Compressor ──
  const compInput = ctx.createGain();
  reverbOutput.connect(compInput);

  const compDry = ctx.createGain();
  const compWet = ctx.createGain();
  const compOutput = ctx.createGain();

  const hasCompressor = typeof ctx.createDynamicsCompressor === "function";
  const compNode = hasCompressor ? ctx.createDynamicsCompressor() : null;
  const compMakeupGainNode = ctx.createGain();

  const getMakeupLinear = (cfg: CompressorConfig) => {
    const auto = cfg.autoMakeup ? calculateAutoMakeupGain(cfg.threshold, cfg.ratio) : 0;
    const totalDb = Math.max(0, Math.min(24, auto + cfg.makeupGain));
    return Math.pow(10, totalDb / 20);
  };

  if (compNode) {
    compNode.threshold.value = currentFx.compressor.threshold;
    compNode.knee.value = currentFx.compressor.knee;
    compNode.ratio.value = currentFx.compressor.ratio;
    compNode.attack.value = currentFx.compressor.attack;
    compNode.release.value = currentFx.compressor.release;
  }
  compMakeupGainNode.gain.value = getMakeupLinear(currentFx.compressor);

  compDry.gain.value = currentFx.compressor.enabled ? 0.0 : 1.0;
  compWet.gain.value = currentFx.compressor.enabled ? 1.0 : 0.0;

  compInput.connect(compDry);
  compDry.connect(compOutput);

  if (compNode) {
    compInput.connect(compNode);
    compNode.connect(compMakeupGainNode);
    compMakeupGainNode.connect(compWet);
  } else {
    compInput.connect(compMakeupGainNode);
    compMakeupGainNode.connect(compWet);
  }
  compWet.connect(compOutput);

  compOutput.connect(output);

  return {
    update: (nextFx: MasterFxConfig) => {
      currentFx = normalizeMasterFx(nextFx);
      const now = ctx.currentTime;

      // Update EQ
      const eqActive = currentFx.eq.enabled;
      eqLow.gain.setValueAtTime(eqActive ? currentFx.eq.lowGain : 0, now);
      eqMid.gain.setValueAtTime(eqActive ? currentFx.eq.midGain : 0, now);
      eqHigh.gain.setValueAtTime(eqActive ? currentFx.eq.highGain : 0, now);

      // Update Modulation
      const modActive = currentFx.modulation.enabled;
      const modParams = getModParams(currentFx.modulation);
      lfo.frequency.setValueAtTime(currentFx.modulation.rate, now);
      delayL.delayTime.setValueAtTime(modParams.baseDelay, now);
      delayR.delayTime.setValueAtTime(modParams.baseDelay, now);
      depthGainL.gain.setValueAtTime(modActive ? modParams.excursion : 0, now);
      depthGainR.gain.setValueAtTime(modActive ? -modParams.excursion : 0, now);
      feedbackL.gain.setValueAtTime(modActive ? modParams.fbScale : 0, now);
      feedbackR.gain.setValueAtTime(modActive ? modParams.fbScale : 0, now);
      modDry.gain.setValueAtTime(modActive ? 1.0 - currentFx.modulation.mix * 0.5 : 1.0, now);
      modWet.gain.setValueAtTime(modActive ? currentFx.modulation.mix : 0.0, now);

      // Update Delay
      const delayActive = currentFx.delay.enabled;
      delayNode.delayTime.setValueAtTime(currentFx.delay.time, now);
      delayFeedback.gain.setValueAtTime(delayActive ? currentFx.delay.feedback : 0, now);
      delayWet.gain.setValueAtTime(delayActive ? currentFx.delay.mix : 0, now);

      // Update Reverb
      const revActive = currentFx.reverb.enabled;
      reverbFilter.frequency.setValueAtTime(currentFx.reverb.tone, now);
      reverbWet.gain.setValueAtTime(revActive ? currentFx.reverb.mix : 0, now);
      if (revActive) {
        convolver.buffer = getReverbImpulse(ctx, currentFx.reverb.decay, currentFx.reverb.tone);
      }

      // Update Dynamics Compressor
      const compActive = currentFx.compressor.enabled;
      if (compNode) {
        compNode.threshold.setValueAtTime(currentFx.compressor.threshold, now);
        compNode.knee.setValueAtTime(currentFx.compressor.knee, now);
        compNode.ratio.setValueAtTime(currentFx.compressor.ratio, now);
        compNode.attack.setValueAtTime(currentFx.compressor.attack, now);
        compNode.release.setValueAtTime(currentFx.compressor.release, now);
      }
      compMakeupGainNode.gain.setValueAtTime(getMakeupLinear(currentFx.compressor), now);
      compDry.gain.setValueAtTime(compActive ? 0.0 : 1.0, now);
      compWet.gain.setValueAtTime(compActive ? 1.0 : 0.0, now);
    },
    dispose: () => {
      try {
        lfo.stop();
      } catch {
        /* ignore */
      }
      try {
        input.disconnect();
        eqLow.disconnect();
        eqMid.disconnect();
        eqHigh.disconnect();
        modInput.disconnect();
        modDry.disconnect();
        modWet.disconnect();
        modOutput.disconnect();
        if (modSplitter) modSplitter.disconnect();
        if (modMerger) modMerger.disconnect();
        delayL.disconnect();
        delayR.disconnect();
        filterL.disconnect();
        filterR.disconnect();
        feedbackL.disconnect();
        feedbackR.disconnect();
        lfo.disconnect();
        depthGainL.disconnect();
        depthGainR.disconnect();
        delayInput.disconnect();
        delayDry.disconnect();
        delayWet.disconnect();
        delayNode.disconnect();
        delayFilter.disconnect();
        delayFeedback.disconnect();
        delayOutput.disconnect();
        reverbInput.disconnect();
        reverbDry.disconnect();
        reverbWet.disconnect();
        convolver.disconnect();
        reverbFilter.disconnect();
        reverbOutput.disconnect();
        compInput.disconnect();
        compDry.disconnect();
        compWet.disconnect();
        if (compNode) compNode.disconnect();
        compMakeupGainNode.disconnect();
        compOutput.disconnect();
      } catch {
        /* Already disconnected */
      }
    },
  };
}
