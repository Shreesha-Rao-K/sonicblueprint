// Programmatic rendering runner for Remotion compositions.
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

interface RenderArgs {
  compositionId?: string;
  frames?: [number, number];
  concurrency?: number;
}

function parseArgs(): RenderArgs {
  const args = process.argv.slice(2);
  const out: RenderArgs = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--composition" && args[i + 1]) {
      out.compositionId = args[++i];
    } else if (args[i] === "--frames" && args[i + 1]) {
      const parts = args[++i].split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        out.frames = [parts[0], parts[1]];
      }
    } else if (args[i] === "--concurrency" && args[i + 1]) {
      out.concurrency = parseInt(args[++i], 10);
    }
  }

  return out;
}

async function main(): Promise<void> {
  const { compositionId, frames, concurrency = 4 } = parseArgs();
  const entryPoint = path.resolve(process.cwd(), "src/index.ts");
  const outputDir = path.resolve(process.cwd(), "../public/tutorials");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`[SonicBlueprint:video] Bundling Remotion video entrypoint...`);
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config: unknown) => config,
  });

  const targetCompositions = compositionId
    ? [compositionId]
    : [
        "DAWOverviewComposition",
        "ChordVoicingComposition",
        "BeatMakerComposition",
        "EffectsMasteryComposition",
        "MobileReelComposition",
      ];

  console.log(`[SonicBlueprint:video] Rendering ${targetCompositions.length} composition(s)...`);

  for (const compId of targetCompositions) {
    const comp = await selectComposition({
      serveUrl: bundleLocation,
      id: compId,
    });

    const outputFile = path.join(
      outputDir,
      `${compId.toLowerCase().replace("composition", "")}.mp4`
    );

    console.log(`[SonicBlueprint:video] Rendering ${compId} -> ${outputFile}...`);

    await renderMedia({
      composition: comp,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation: outputFile,
      concurrency,
      frameRange: frames,
      onProgress: ({ progress }: { progress: number }) => {
        const pct = Math.round(progress * 100);
        if (pct % 20 === 0) {
          process.stdout.write(`\rRendering ${compId}: ${pct}%`);
        }
      },
    });

    console.log(`\n[SonicBlueprint:video] Completed ${compId}: ${outputFile}`);
  }

  console.log(`[SonicBlueprint:video] All requested renders completed successfully.`);
}

main().catch((err) => {
  console.error(`[SonicBlueprint:video] Render failed:`, err);
  process.exit(1);
});
