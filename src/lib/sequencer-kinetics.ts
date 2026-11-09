// SonicBlueprint Sequencer Kinetics & Micro-Interactions Engine
// Pure mathematical functions for step timing derivation, pad triggering, GPU playhead translation,
// DIN PPM ballistic audio metering decay, and velocity-sensitive drag scaling.

export interface StepTimingResult {
  currentStep: number;
  stepProgress: number; // 0 to 1 within current step
  barProgress: number;  // 0 to 1 within current bar
  barSec: number;
  stepSec: number;
}

/**
 * Calculates deterministic musical step timing from continuous playback position.
 */
export function calculateStepTiming(
  positionSec: number,
  bpm: number,
  steps = 16,
  timeSignature = "4/4"
): StepTimingResult {
  const safeBpm = Math.max(20, Math.min(300, bpm || 120));
  const safeSteps = Math.max(1, steps || 16);

  // Parse time signature (e.g. 4/4, 3/4, 6/8)
  const parts = timeSignature.split("/").map(Number);
  const num = parts[0] || 4;
  const den = parts[1] || 4;
  const quarterBeatsPerBar = num * (4 / den);

  const beatSec = 60 / safeBpm;
  const barSec = beatSec * quarterBeatsPerBar;
  const stepSec = barSec / safeSteps;

  const nonNegPos = Math.max(0, positionSec);
  const posInBar = nonNegPos % barSec;

  const barProgress = barSec > 0 ? posInBar / barSec : 0;
  const currentStep = Math.min(
    safeSteps - 1,
    Math.max(0, Math.floor(posInBar / (stepSec || 1)))
  );
  const stepProgress = stepSec > 0 ? (posInBar % stepSec) / stepSec : 0;

  return {
    currentStep,
    stepProgress,
    barProgress,
    barSec,
    stepSec,
  };
}

/**
 * Evaluates whether a drum sequencer pad triggers a visual luminescent flash at this instant.
 * Handles independent polymeter/polyrhythm cycles per drum row.
 */
export function isPadTriggered(
  stepIndex: number,
  currentStep: number,
  rowCycle: number | undefined,
  isPlaying: boolean,
  padActive: boolean
): boolean {
  if (!isPlaying || !padActive) return false;

  if (rowCycle !== undefined && rowCycle > 0) {
    const stepInCycle = stepIndex % rowCycle;
    const playheadCycle = currentStep % rowCycle;
    return stepInCycle === playheadCycle;
  }

  return stepIndex === currentStep;
}

/**
 * Computes GPU-accelerated 3D transform string for zero-reflow playhead gliding.
 */
export function calculatePlayheadTranslate3d(
  barProgress: number,
  gridWidthPx: number
): { transform: string; xPx: number } {
  const clampedProgress = Math.max(0, Math.min(1, barProgress));
  const xPx = clampedProgress * Math.max(0, gridWidthPx);
  return {
    transform: `translate3d(${xPx.toFixed(2)}px, 0, 0)`,
    xPx,
  };
}

/**
 * Professional DIN PPM / IEC audio ballistic level integration.
 * Fast attack (<=10ms) to capture drum transients, logarithmic decay (-20 dB/s).
 */
export function updateVuBallistics(
  currentLinear: number,
  targetLinear: number,
  dtSeconds: number,
  attackTime = 0.008,
  decayRateDbPerSec = 20
): number {
  const safeDt = Math.max(0, dtSeconds);

  if (targetLinear > currentLinear) {
    // Instantaneous or ultra-fast exponential rise
    const alpha = 1 - Math.exp(-safeDt / Math.max(0.001, attackTime));
    return currentLinear + (targetLinear - currentLinear) * alpha;
  } else {
    // Logarithmic decay: level drops by decayRateDbPerSec in decibels
    // linearFactor = 10^(-(decayRate * dt) / 20)
    const decayFactor = Math.pow(10, -(decayRateDbPerSec * safeDt) / 20);
    return Math.max(0, currentLinear * decayFactor);
  }
}

export interface PeakHoldState {
  peak: number;
  holdTimeRemaining: number;
}

/**
 * Peak hold ballistics with latching and configurable hold duration (e.g. 1.2s).
 */
export function updatePeakHold(
  currentState: PeakHoldState,
  newSample: number,
  dtSeconds: number,
  holdDuration = 1.2
): PeakHoldState {
  const safeDt = Math.max(0, dtSeconds);

  if (newSample >= currentState.peak) {
    return {
      peak: newSample,
      holdTimeRemaining: holdDuration,
    };
  }

  if (currentState.holdTimeRemaining > safeDt) {
    return {
      peak: currentState.peak,
      holdTimeRemaining: currentState.holdTimeRemaining - safeDt,
    };
  }

  // Hold expired: decay peak smoothly towards current sample
  const decayedPeak = updateVuBallistics(currentState.peak, newSample, safeDt, 0.01, 30);
  return {
    peak: Math.max(newSample, decayedPeak),
    holdTimeRemaining: 0,
  };
}

/**
 * Converts linear amplitude (0..1) to decibels full scale (dBFS).
 */
export function linearToDb(linear: number, minDb = -60): number {
  if (linear <= 0.00001) return minDb;
  const db = 20 * Math.log10(linear);
  return Math.max(minDb, db);
}

/**
 * Normalizes dBFS to 0..1 range for meters.
 */
export function dbToMeterNorm(db: number, minDb = -48, maxDb = 3): number {
  if (db <= minDb) return 0;
  if (db >= maxDb) return 1;
  return (db - minDb) / (maxDb - minDb);
}

/**
 * Applies fine-drag scaling (Shift key modifier or mobile fine slider toggle).
 */
export function applyFineDragDelta(
  pixelDelta: number,
  isFine: boolean,
  totalRange: number,
  trackLengthPx = 200,
  fineScaleFactor = 0.2
): number {
  const baseDelta = (pixelDelta / Math.max(1, trackLengthPx)) * totalRange;
  return isFine ? baseDelta * fineScaleFactor : baseDelta;
}

/**
 * Determines closest snap detent for mobile bottom drawer.
 * Detents: 0 (closed), 0.45 (half detent), 0.90 (full detent).
 */
export function calculateSnapDetent(
  currentRatio: number,
  velocityRatio: number,
  detents = [0, 0.45, 0.9]
): number {
  // If flick velocity is significant, favor direction
  if (velocityRatio > 0.4) {
    // Flick downward
    const lower = detents.filter((d) => d < currentRatio);
    return lower.length > 0 ? Math.max(...lower) : detents[0];
  } else if (velocityRatio < -0.4) {
    // Flick upward
    const higher = detents.filter((d) => d > currentRatio);
    return higher.length > 0 ? Math.min(...higher) : detents[detents.length - 1];
  }

  // Otherwise, find closest detent by distance
  let closest = detents[0];
  let minDiff = Infinity;
  for (const d of detents) {
    const diff = Math.abs(currentRatio - d);
    if (diff < minDiff) {
      minDiff = diff;
      closest = d;
    }
  }
  return closest;
}
