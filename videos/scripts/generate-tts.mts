// 3-tier speech synthesis generator (edge-tts -> Windows SAPI -> offline PCM).
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { TUTORIAL_NARRATION_CHAPTERS } from "../src/audio/tutorial-narration-data.js";

const NARRATION_DIR = path.resolve(process.cwd(), "videos/audio/narration");

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function synthesizeTier1EdgeTts(text: string, outputPath: string): boolean {
  try {
    const cmd = `edge-tts --voice en-US-AndrewMultilingualNeural --rate="-5%" --text "${text.replace(/"/g, '\\"')}" --write-media "${outputPath}"`;
    execSync(cmd, { stdio: "ignore", timeout: 25000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000;
  } catch {
    return false;
  }
}

function synthesizeTier2WindowsSapi(text: string, outputPath: string): boolean {
  try {
    const script = `
      Add-Type -AssemblyName System.Speech;
      $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer;
      $synth.SetOutputToWaveFile('${outputPath.replace(/'/g, "''")}');
      $synth.Rate = -1;
      $synth.Speak('${text.replace(/'/g, "''")}');
      $synth.Dispose();
    `.replace(/\r?\n\s+/g, " ");

    execSync(`powershell -NoProfile -Command "${script}"`, { stdio: "ignore", timeout: 20000 });
    return fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000;
  } catch {
    return false;
  }
}

function synthesizeTier3OfflineTone(outputPath: string, durationSec: number): void {
  // Generate a soft carrier waveform with FFmpeg flite/sine for offline test environments
  try {
    execSync(
      `ffmpeg -y -f lavfi -i "sine=frequency=220:duration=${Math.min(durationSec, 3)}:sample_rate=48000" -af "volume=0.05" -c:a pcm_s16le "${outputPath}"`,
      { stdio: "ignore" }
    );
  } catch {
    // If FFmpeg isn't present, write a minimal 1-second 48kHz WAV header
    const sampleRate = 48000;
    const numSamples = sampleRate;
    const buffer = Buffer.alloc(44 + numSamples * 2);
    buffer.write("RIFF", 0);
    buffer.writeUInt32LE(36 + numSamples * 2, 4);
    buffer.write("WAVE", 8);
    buffer.write("fmt ", 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write("data", 36);
    buffer.writeUInt32LE(numSamples * 2, 40);
    fs.writeFileSync(outputPath, buffer);
  }
}

async function main(): Promise<void> {
  ensureDir(NARRATION_DIR);
  console.log(`[SonicBlueprint:tts] Synthesizing 8 chapters of tutorial narration...`);

  const chapterWavs: string[] = [];

  for (const ch of TUTORIAL_NARRATION_CHAPTERS) {
    const chapterBase = path.join(NARRATION_DIR, `chapter_${ch.number.toString().padStart(2, "0")}`);
    const tempMp3 = `${chapterBase}_edge.mp3`;
    const finalWav = `${chapterBase}.wav`;

    console.log(`[SonicBlueprint:tts] Chapter ${ch.number}: "${ch.title}" (${ch.durationSeconds}s)...`);

    let success = false;
    // Tier 1: edge-tts
    if (synthesizeTier1EdgeTts(ch.voiceoverScript, tempMp3)) {
      try {
        execSync(`ffmpeg -y -i "${tempMp3}" -ar 48000 -ac 2 -c:a pcm_s16le "${finalWav}"`, { stdio: "ignore" });
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        console.log(`  -> Tier 1 edge-tts succeeded.`);
        success = true;
      } catch {
        // fallback
      }
    }

    // Tier 2: Windows SAPI
    if (!success) {
      const tempSapiWav = `${chapterBase}_sapi.wav`;
      if (synthesizeTier2WindowsSapi(ch.voiceoverScript, tempSapiWav)) {
        try {
          execSync(`ffmpeg -y -i "${tempSapiWav}" -ar 48000 -ac 2 -c:a pcm_s16le "${finalWav}"`, { stdio: "ignore" });
          if (fs.existsSync(tempSapiWav)) fs.unlinkSync(tempSapiWav);
          console.log(`  -> Tier 2 Windows SAPI succeeded.`);
          success = true;
        } catch {
          // fallback
        }
      }
    }

    // Tier 3: Offline asset fallback
    if (!success) {
      console.log(`  -> Tier 3 Offline fallback engaged.`);
      synthesizeTier3OfflineTone(finalWav, ch.durationSeconds);
    }

    chapterWavs.push(finalWav);
  }

  // Stitch full 420.0s timeline track
  const fullTrackPath = path.join(NARRATION_DIR, "narration_full_420s.wav");
  console.log(`[SonicBlueprint:tts] Stitching full 420.0s narration master track -> ${fullTrackPath}...`);

  try {
    // Build FFmpeg complex filter to delay each chapter to its exact startTimeSeconds
    const filterInputs = chapterWavs.map((_, i) => `[${i}:a]adelay=${TUTORIAL_NARRATION_CHAPTERS[i].startTimeSeconds * 1000}|${TUTORIAL_NARRATION_CHAPTERS[i].startTimeSeconds * 1000}[a${i}]`).join(";");
    const mixInputs = chapterWavs.map((_, i) => `[a${i}]`).join("");
    const filterComplex = `${filterInputs};${mixInputs}amix=inputs=${chapterWavs.length}:duration=longest:dropout_transition=0:normalize=0,apad=whole_dur=420[out]`;

    const inputArgs = chapterWavs.map((p) => `-i "${p}"`).join(" ");
    execSync(`ffmpeg -y ${inputArgs} -filter_complex "${filterComplex}" -map "[out]" -t 420 -c:a pcm_s16le "${fullTrackPath}"`, {
      stdio: "ignore",
    });
    console.log(`[SonicBlueprint:tts] Successfully generated 420.0s master speech track.`);
  } catch (err) {
    console.warn(`[SonicBlueprint:tts] Stitching failed, writing fallback 420s master:`, err);
    synthesizeTier3OfflineTone(fullTrackPath, 420);
  }
}

main().catch((err) => {
  console.error(`[SonicBlueprint:tts] Generation failed:`, err);
  process.exit(1);
});
