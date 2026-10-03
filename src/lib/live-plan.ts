// Live playback planning: bounded-horizon event invalidation for editing
// while playing. The realtime scheduler only ever sounds events ≤0.14s ahead,
// so a project edit takes effect by rebuilding the deterministic event plan
// (the same buildSongEvents both realtime and offline use) and moving the
// read indices to just past the already-scheduled horizon. Already-created
// voices (≤0.14s of audio) finish naturally — never truncated, never doubled.

/** Scheduler look-ahead in seconds. Mirrors the engine pump horizon: events
 * are only created (as Web Audio nodes) inside this window, so everything
 * beyond it can be invalidated safely on edit. */
export const SCHEDULER_HORIZON = 0.14;

/** Minimal event shape the live plan reasons about (times only). */
export interface TimedEvent {
  time: number;
}

export interface LiveIndices {
  noteIdx: number;
  drumIdx: number;
}

/** First index at/after the live-update boundary. Events before the boundary
 * were already created from the previous plan and will sound out naturally;
 * resuming reads after them prevents duplicates without dropping anything. */
export function rebaseIndices<T extends TimedEvent>(
  notes: T[],
  drums: TimedEvent[],
  positionSec: number,
  horizonSec = SCHEDULER_HORIZON
): LiveIndices {
  const boundary = Math.max(0, positionSec + horizonSec + 0.005);
  return {
    noteIdx: firstIndexAtOrAfter(notes, boundary),
    drumIdx: firstIndexAtOrAfter(drums, boundary),
  };
}

function firstIndexAtOrAfter(arr: TimedEvent[], t: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].time < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Sort + index a freshly built plan at a start offset (initial play or
 * section jump). Pure: the transport clock is never touched. */
export function planIndices<T extends TimedEvent>(
  events: T[],
  startAtSec: number
): number {
  return firstIndexAtOrAfter(events, startAtSec);
}
