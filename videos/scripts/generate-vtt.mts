// WebVTT caption generator and validator.
import path from "node:path";
import fs from "node:fs";
import { PC_TUTORIAL_VTT, PHONE_TUTORIAL_VTT } from "../../src/lib/tutorial-data.js";
import { parseWebVtt } from "../../src/lib/vtt-parser.js";

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function validateAndFormatVtt(vttString: string, label: string): string {
  const cues = parseWebVtt(vttString);
  console.log(`[SonicBlueprint:vtt] Validated ${cues.length} cues for ${label}.`);

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (cue.startTime >= cue.endTime) {
      throw new Error(`Invalid cue timing in ${label} at cue ${cue.id}: ${cue.startTime} >= ${cue.endTime}`);
    }
    if (i > 0 && cue.startTime < cues[i - 1].startTime) {
      throw new Error(`Cues out of chronological order in ${label} at cue ${cue.id}`);
    }
  }

  return vttString.trim() + "\n";
}

async function main(): Promise<void> {
  const publicDir = path.resolve(process.cwd(), "public/tutorials");
  const captionsDir = path.resolve(process.cwd(), "videos/captions");

  ensureDir(publicDir);
  ensureDir(captionsDir);

  const pcFormatted = validateAndFormatVtt(PC_TUTORIAL_VTT, "PC Desktop Tutorial");
  const phoneFormatted = validateAndFormatVtt(PHONE_TUTORIAL_VTT, "Phone Mobile Tutorial");

  // Output to public/tutorials/
  const pcPublicPath = path.join(publicDir, "pc-tutorial.en.vtt");
  const phonePublicPath = path.join(publicDir, "phone-tutorial.en.vtt");
  fs.writeFileSync(pcPublicPath, pcFormatted, "utf8");
  fs.writeFileSync(phonePublicPath, phoneFormatted, "utf8");

  // Output to videos/captions/
  fs.writeFileSync(path.join(captionsDir, "pc-tutorial.en.vtt"), pcFormatted, "utf8");
  fs.writeFileSync(path.join(captionsDir, "phone-tutorial.en.vtt"), phoneFormatted, "utf8");

  console.log(`[SonicBlueprint:vtt] Successfully generated and verified WebVTT caption files:`);
  console.log(`  -> ${pcPublicPath}`);
  console.log(`  -> ${phonePublicPath}`);
}

main().catch((err) => {
  console.error(`[SonicBlueprint:vtt] Caption generation failed:`, err);
  process.exit(1);
});
