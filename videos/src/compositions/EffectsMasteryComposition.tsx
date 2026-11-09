import React from "react";
import { Sequence, staticFile, Video } from "remotion";
import { SpringCameraRig } from "../camera/SpringCameraRig.js";
import { CalloutCard } from "../callouts/CalloutCard.js";
import { FocusHalo } from "../callouts/FocusHalo.js";
import { AgentCursor } from "../callouts/AgentCursor.js";
import { TitleCardLockup } from "../titles/TitleCardLockup.js";
import type { CameraKeyframe } from "../types.js";

const keyframes: CameraKeyframe[] = [
  { startFrame: 0, durationInFrames: 30, anchorX: 50, anchorY: 50, zoom: 1.0 },
  { startFrame: 60, durationInFrames: 45, anchorX: 46, anchorY: 52, zoom: 2.1 },
  { startFrame: 900, durationInFrames: 45, anchorX: 40, anchorY: 52, zoom: 2.25 },
  { startFrame: 1800, durationInFrames: 45, anchorX: 52, anchorY: 52, zoom: 2.25 },
  { startFrame: 2550, durationInFrames: 45, anchorX: 50, anchorY: 50, zoom: 1.0 },
];

export const EffectsMasteryComposition: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#06070d", position: "relative" }}>
      <SpringCameraRig keyframes={keyframes}>
        <div style={{ width: 1920, height: 1080, position: "relative" }}>
          <Video
            src={staticFile("tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4")}
            startFrom={5250} // 2:55 mark in review video
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </SpringCameraRig>

      {/* Intro Lockup */}
      <Sequence from={0} durationInFrames={90}>
        <TitleCardLockup
          kicker="AUDIO ENGINEERING MASTERCLASS"
          title="Master DSP Effects & Bus Compression"
          subtitle="Explore hardware-modeled compression, convolution reverb, and stereo delay."
          durationInFrames={90}
        />
      </Sequence>

      {/* Part 1: Bus Compressor */}
      <Sequence from={90} durationInFrames={810}>
        <CalloutCard
          badge="DYNAMICS GLUE"
          stepNumber={1}
          totalSteps={3}
          title="Master Bus Compressor & Sidechain"
          subtitle="4:1 compression ratio with 50ms attack and 300ms release for punchy, glue dynamics."
          keyboardShortcut="C"
          durationInFrames={810}
        />
        <FocusHalo
          x={46}
          y={52}
          width={280}
          height={80}
          label="Bus Compressor 4:1"
          durationInFrames={810}
        />
        <AgentCursor
          startX={38}
          startY={65}
          endX={46}
          endY={52}
          clickFrame={35}
          durationInFrames={810}
        />
      </Sequence>

      {/* Part 2: Convolution Reverb */}
      <Sequence from={900} durationInFrames={900}>
        <CalloutCard
          badge="SPATIAL ACOUSTICS"
          stepNumber={2}
          totalSteps={3}
          title="Convolver Reverb Hall Algorithm"
          subtitle="True impulse response simulation with dampening tone filter and stereo spread."
          durationInFrames={900}
        />
        <FocusHalo
          x={40}
          y={52}
          width={180}
          height={80}
          label="Studio Hall Decay"
          durationInFrames={900}
        />
      </Sequence>

      {/* Part 3: Tempo-Synced Delay & EQ */}
      <Sequence from={1800} durationInFrames={750}>
        <CalloutCard
          badge="STEREO FIELD"
          stepNumber={3}
          totalSteps={3}
          title="Tempo-Synced Delay & 3-Band Parametric EQ"
          subtitle="Dotted-eighth echo repeats and master high-shelf air boost at 12kHz."
          durationInFrames={750}
        />
      </Sequence>

      {/* Outro */}
      <Sequence from={2550} durationInFrames={150}>
        <TitleCardLockup
          kicker="TRY IN STUDIO"
          title="Load Orchestral FX Stack Preset"
          subtitle="Hear this mastered DSP chain live in SonicBlueprint Studio."
          durationInFrames={150}
        />
      </Sequence>
    </div>
  );
};
