// WebVTT caption parser and binary search cue locator.

export interface WebVttCue {
  id: string;
  startTime: number; // seconds
  endTime: number; // seconds
  text: string;
}

/**
 * Parses timestamp string 'HH:MM:SS.mmm' or 'MM:SS.mmm' into floating-point seconds.
 */
export function parseVttTimestamp(ts: string): number {
  const clean = ts.trim().split(" ")[0]; // remove any cue settings
  const parts = clean.split(":");
  if (parts.length === 3) {
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const m = parseFloat(parts[0]);
    const s = parseFloat(parts[1]);
    return m * 60 + s;
  }
  return 0;
}

/**
 * Formats seconds into 'M:SS' or 'H:MM:SS' for display.
 */
export function formatTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Parses a standard WebVTT string into structured cue objects.
 */
export function parseWebVtt(vttString: string): WebVttCue[] {
  if (!vttString) return [];
  const lines = vttString.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const cues: WebVttCue[] = [];

  let i = 0;
  // Skip WEBVTT header and comments
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.includes("-->")) {
      let cueId = `cue_${cues.length + 1}`;
      // Check if previous line had a custom identifier
      if (i > 0 && lines[i - 1].trim() && !lines[i - 1].includes("-->") && !lines[i - 1].startsWith("NOTE")) {
        cueId = lines[i - 1].trim();
      }

      const [startStr, endWithSettings] = line.split("-->");
      const startTime = parseVttTimestamp(startStr);
      const endTime = parseVttTimestamp(endWithSettings);

      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        // Exclude inline HTML tags from text
        const cleanText = lines[i].replace(/<[^>]+>/g, "").trim();
        if (cleanText) textLines.push(cleanText);
        i++;
      }

      cues.push({
        id: cueId,
        startTime,
        endTime,
        text: textLines.join(" "),
      });
    } else {
      i++;
    }
  }

  return cues.sort((a, b) => a.startTime - b.startTime);
}

/**
 * High-performance binary search to find the active cue at a given timestamp.
 */
export function findActiveCue(cues: WebVttCue[], timeSeconds: number): WebVttCue | null {
  if (!cues || cues.length === 0) return null;
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (timeSeconds < cue.startTime) {
      high = mid - 1;
    } else if (timeSeconds >= cue.endTime) {
      low = mid + 1;
    } else {
      return cue;
    }
  }

  return null;
}
