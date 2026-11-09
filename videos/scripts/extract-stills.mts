// Keyframe poster thumbnail extractor for tutorial chapters.
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { PC_COMPOSITION_CHAPTERS } from "../src/data/chapters-pc.js";

async function main(): Promise<void> {
  const entryPoint = path.resolve(process.cwd(), "src/index.ts");
  const posterDir = path.resolve(process.cwd(), "../public/tutorials/posters");

  if (!fs.existsSync(posterDir)) {
    fs.mkdirSync(posterDir, { recursive: true });
  }

  console.log(`[SonicBlueprint:stills] Bundling composition entrypoint...`);
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config: unknown) => config,
  });

  const comp = await selectComposition({
    serveUrl: bundleLocation,
    id: "DAWOverviewComposition",
  });

  console.log(`[SonicBlueprint:stills] Extracting ${PC_COMPOSITION_CHAPTERS.length} chapter poster thumbnails...`);

  for (const ch of PC_COMPOSITION_CHAPTERS) {
    const frame = ch.startFrame + 15; // sample 0.5s into chapter
    const outputPath = path.join(posterDir, `chapter-${ch.chapterNumber.toString().padStart(2, "0")}.jpg`);

    console.log(`[SonicBlueprint:stills] Extracting frame ${frame} for ${ch.title} -> ${outputPath}`);

    await renderStill({
      composition: comp,
      serveUrl: bundleLocation,
      output: outputPath,
      frame,
      imageFormat: "jpeg",
      jpegQuality: 90,
    });
  }

  console.log(`[SonicBlueprint:stills] All chapter posters successfully extracted.`);
}

main().catch((err) => {
  console.error(`[SonicBlueprint:stills] Extraction failed:`, err);
  process.exit(1);
});
