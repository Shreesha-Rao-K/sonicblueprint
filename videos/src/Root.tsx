import React from "react";
import { Composition } from "remotion";
import { DAWOverviewComposition } from "./compositions/DAWOverviewComposition.js";
import { ChordVoicingComposition } from "./compositions/ChordVoicingComposition.js";
import { BeatMakerComposition } from "./compositions/BeatMakerComposition.js";
import { EffectsMasteryComposition } from "./compositions/EffectsMasteryComposition.js";
import { MobileReelComposition } from "./compositions/MobileReelComposition.js";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 1. Complete 12-Chapter Desktop Walkthrough (420s = 12,600 frames) */}
      <Composition
        id="DAWOverviewComposition"
        component={DAWOverviewComposition}
        durationInFrames={12600}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 2. Deep Dive: Chord Voicings & Modal Scales (90s = 2,700 frames) */}
      <Composition
        id="ChordVoicingComposition"
        component={ChordVoicingComposition}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 3. Deep Dive: Beatmaker Drum Sequencer & Polyrhythms (90s = 2,700 frames) */}
      <Composition
        id="BeatMakerComposition"
        component={BeatMakerComposition}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 4. Deep Dive: Master DSP Effects & Bus Compressor (90s = 2,700 frames) */}
      <Composition
        id="EffectsMasteryComposition"
        component={EffectsMasteryComposition}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
      />

      {/* 5. Short-Form Social Reel (9:16 Vertical, 60s = 1,800 frames) */}
      <Composition
        id="MobileReelComposition"
        component={MobileReelComposition}
        durationInFrames={1800}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
