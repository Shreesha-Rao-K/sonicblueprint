export type AnnouncementPriority = "polite" | "assertive";

export interface A11yMessage {
  id: number;
  message: string;
  priority: AnnouncementPriority;
  timestamp: number;
}

let messageCounter = 0;
type Listener = (msg: A11yMessage) => void;
const listeners = new Set<Listener>();

export function announce(message: string, priority: AnnouncementPriority = "polite"): void {
  if (!message || !message.trim()) return;
  const payload: A11yMessage = {
    id: ++messageCounter,
    message: message.trim(),
    priority,
    timestamp: Date.now(),
  };
  listeners.forEach((l) => {
    try {
      l(payload);
    } catch {
      // guard listener execution
    }
  });
}

export function subscribeAnnouncer(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Semantic helper announcers for DAW events
export function announceTransport(state: "playing" | "paused" | "stopped" | "recording"): void {
  const map: Record<string, string> = {
    playing: "Playback started",
    paused: "Playback paused",
    stopped: "Playback stopped",
    recording: "Recording started",
  };
  announce(map[state] ?? `Transport ${state}`, "assertive");
}

export function announceTempo(bpm: number): void {
  announce(`Tempo set to ${bpm} BPM`, "polite");
}

export function announcePreset(name: string): void {
  announce(`Loaded preset ${name}`, "polite");
}

export function announceSequencer(instrument: string, step: number, state: boolean): void {
  announce(`${instrument} step ${step + 1} ${state ? "on" : "off"}`, "polite");
}
