// Tests: Tactile Micro-Interactions, Step Timing Kinetics, Playhead GPU Transforms, and DIN PPM Ballistics.
import { suite, test, ok, eq, approx } from "./helpers.js";
import {
  calculateStepTiming,
  isPadTriggered,
  calculatePlayheadTranslate3d,
  updateVuBallistics,
  updatePeakHold,
  linearToDb,
  dbToMeterNorm,
  applyFineDragDelta,
  type PeakHoldState,
} from "@/lib/sequencer-kinetics";

suite("Sequencer Kinetics & Step Timing Math");

test("calculateStepTiming produces accurate step indices and progress at 120 BPM 4/4", () => {
  // At 120 BPM, 1 quarter beat = 0.5s.
  // In 4/4 time, 1 bar = 4 * 0.5 = 2.0s.
  // With 16 steps per bar, 1 step = 2.0 / 16 = 0.125s (125ms).
  const bpm = 120;
  const steps = 16;
  const timeSig = "4/4";

  // At t = 0.0s -> step 0
  const t0 = calculateStepTiming(0.0, bpm, steps, timeSig);
  eq(t0.currentStep, 0);
  approx(t0.stepProgress, 0.0, 1e-4);
  approx(t0.barProgress, 0.0, 1e-4);
  approx(t0.barSec, 2.0, 1e-4);
  approx(t0.stepSec, 0.125, 1e-4);

  // At t = 0.25s -> step 2
  const t1 = calculateStepTiming(0.25, bpm, steps, timeSig);
  eq(t1.currentStep, 2);
  approx(t1.barProgress, 0.25 / 2.0, 1e-4);

  // At t = 1.0s -> halfway through bar, step 8
  const t2 = calculateStepTiming(1.0, bpm, steps, timeSig);
  eq(t2.currentStep, 8);
  approx(t2.barProgress, 0.5, 1e-4);

  // At t = 2.125s -> step 1 of bar 2 (wraps modulo bar duration)
  const t3 = calculateStepTiming(2.125, bpm, steps, timeSig);
  eq(t3.currentStep, 1);
  approx(t3.barProgress, 0.125 / 2.0, 1e-4);
});

test("calculateStepTiming handles 3/4 waltz time signature and 12 steps", () => {
  // 3/4 time at 120 BPM: 3 beats * 0.5s = 1.5s bar.
  // 12 steps: 1.5 / 12 = 0.125s per step.
  const res = calculateStepTiming(0.75, 120, 12, "3/4");
  approx(res.barSec, 1.5, 1e-4);
  approx(res.barProgress, 0.5, 1e-4);
  eq(res.currentStep, 6);
});

test("calculateStepTiming clamps negative playback times safely to 0", () => {
  const neg = calculateStepTiming(-0.5, 120, 16, "4/4");
  eq(neg.currentStep, 0);
  approx(neg.barProgress, 0.0, 1e-4);
});

suite("Luminescent Pad Triggering & Polymeter Invariants");

test("isPadTriggered triggers when playhead matches step on active pad", () => {
  ok(isPadTriggered(4, 4, undefined, true, true));
  ok(!isPadTriggered(4, 5, undefined, true, true));
  ok(!isPadTriggered(4, 4, undefined, false, true), "Should not trigger when paused");
  ok(!isPadTriggered(4, 4, undefined, true, false), "Should not trigger on empty pad");
});

test("isPadTriggered accurately maps polymeter row cycles", () => {
  // Row has a 5-step cycle on a 16-step grid
  const rowCycle = 5;
  // Step 2 in a 5-step cycle triggers on global step 2, 7, 12
  ok(isPadTriggered(2, 2, rowCycle, true, true));
  ok(isPadTriggered(2, 7, rowCycle, true, true));
  ok(isPadTriggered(2, 12, rowCycle, true, true));
  ok(!isPadTriggered(2, 3, rowCycle, true, true));
});

suite("GPU Playhead 3D Transform Invariants");

test("calculatePlayheadTranslate3d generates valid translate3d CSS property", () => {
  const gridWidth = 800;
  const p0 = calculatePlayheadTranslate3d(0.0, gridWidth);
  eq(p0.transform, "translate3d(0.00px, 0, 0)");
  approx(p0.xPx, 0, 1e-2);

  const p50 = calculatePlayheadTranslate3d(0.5, gridWidth);
  eq(p50.transform, "translate3d(400.00px, 0, 0)");
  approx(p50.xPx, 400, 1e-2);

  const p100 = calculatePlayheadTranslate3d(1.0, gridWidth);
  eq(p100.transform, "translate3d(800.00px, 0, 0)");
  approx(p100.xPx, 800, 1e-2);
});

test("calculatePlayheadTranslate3d clamps overshooting progress to grid boundary", () => {
  const over = calculatePlayheadTranslate3d(1.25, 600);
  eq(over.transform, "translate3d(600.00px, 0, 0)");
});

suite("DIN PPM Ballistics & Decibel Conversions");

test("updateVuBallistics attacks near-instantaneously on rising transients", () => {
  const current = 0.0;
  const target = 1.0;
  const dt = 0.01; // 10ms
  const next = updateVuBallistics(current, target, dt, 0.008, 20);
  ok(next >= 0.7, `Attack after 10ms must reach >= 70% of target (got ${next})`);
});

test("updateVuBallistics decays logarithmically at ~20 dB per second", () => {
  const startLinear = 1.0; // 0 dBFS
  const target = 0.0;
  // After 1.0s, at -20 dB/s decay, level should be 10^(-20/20) = 0.1 (-20 dBFS)
  const after1s = updateVuBallistics(startLinear, target, 1.0, 0.008, 20);
  approx(after1s, 0.1, 0.015);
});

test("updatePeakHold latches peak for specified hold duration", () => {
  const initial: PeakHoldState = { peak: 0.8, holdTimeRemaining: 1.2 };
  // Lower sample arriving while holding
  const held = updatePeakHold(initial, 0.4, 0.2, 1.2);
  approx(held.peak, 0.8, 1e-4);
  approx(held.holdTimeRemaining, 1.0, 1e-4);

  // Expired hold decays smoothly
  const expired: PeakHoldState = { peak: 0.8, holdTimeRemaining: 0.05 };
  const afterExpire = updatePeakHold(expired, 0.2, 0.3, 1.2);
  ok(afterExpire.peak < 0.8, "Peak should decay after hold time expires");
  ok(afterExpire.peak >= 0.2, "Decayed peak should not drop below current sample");
});

test("linearToDb and dbToMeterNorm convert full scale amplitudes correctly", () => {
  approx(linearToDb(1.0), 0.0, 1e-3);
  approx(linearToDb(0.1), -20.0, 1e-3);
  approx(linearToDb(0.01), -40.0, 1e-3);

  approx(dbToMeterNorm(0, -48, 0), 1.0, 1e-3);
  approx(dbToMeterNorm(-48, -48, 0), 0.0, 1e-3);
  approx(dbToMeterNorm(-24, -48, 0), 0.5, 1e-3);
});

suite("Fine Drag Scaling");

test("applyFineDragDelta scales sensitivity by 0.2 when Shift modifier held", () => {
  const pixelDelta = 50;
  const totalRange = 10;
  const trackPx = 200;

  const normal = applyFineDragDelta(pixelDelta, false, totalRange, trackPx, 0.2);
  const fine = applyFineDragDelta(pixelDelta, true, totalRange, trackPx, 0.2);

  approx(normal, 2.5, 1e-4);
  approx(fine, 0.5, 1e-4);
  approx(fine, normal * 0.2, 1e-4);
});
