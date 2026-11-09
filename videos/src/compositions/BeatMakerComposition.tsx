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
  { startFrame: 60, durationInFrames: 45, anchorX: 46, anchorY: 48, zoom: 2.1 },
  { startFrame: 900, durationInFrames: 45, anchorX: 46, anchorY: 40, zoom: 2.3 },
  { startFrame: 1800, durationInFrames: 45, anchorX: 50, anchorY: 45, zoom: 1.85 },
  { startFrame: 2550, durationInFrames: 45, anchorX: 50, anchorY: 50, zoom: 1.0 },
];

export const BeatMakerComposition: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#06070d", position: "relative" }}>
      <SpringCameraRig keyframes={keyframes}>
        <div style={{ width: 1920, height: 1080, position: "relative" }}>
          <Video
            src={staticFile("tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4")}
            startFrom={4200} // 2:20 mark in review video
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </SpringCameraRig>

      {/* Intro Lockup */}
      <Sequence from={0} durationInFrames={90}>
        <TitleCardLockup
          kicker="BEATMAKER MASTERCLASS"
          title="Polyrhythms & Velocity Accents"
          subtitle="Program dynamic drum grooves with poly-meter loops, velocity accents, and swing."
          durationInFrames={90}
        />
      </Sequence>

      {/* Part 1: Step Matrix & Poly-meter */}
      <Sequence from={90} durationInFrames={810}>
        <CalloutCard
          badge="POLY-METER MATRIX"
          stepNumber={1}
          totalSteps={3}
          title="16-Step Grid & Independent Row Cycles"
          subtitle="Set independent loop cycle lengths per drum row (e.g. 4-step kick + 3-step perc)."
          durationInFrames={810}
        />
        <FocusHalo
          x={46}
          y={48}
          width={380}
          height={120}
          label="Polyrhythm Drum Rows"
          durationInFrames={810}
        />
        <AgentCursor
          startX={35}
          startY={60}
          endX={46}
          endY={48}
          clickFrame={40}
          durationInFrames={810}
        />
      </Sequence>

      {/* Part 2: Dynamic Accent Row */}
      <Sequence from={900} durationInFrames={900}>
        <CalloutCard
          badge="DYNAMIC PUNCH"
          stepNumber={2}
          totalSteps={3}
          title="Velocity Accents (+25% Punch)"
          subtitle="Accent downbeats or syncopated offbeats with a +25% gain boost for real dynamic feel."
          durationInFrames={900}
        />
        <FocusHalo
          x={46}
          y={40}
          width={360}
          height={48}
          label="Accent Row Buttons"
          durationInFrames={900}
        />
      </Sequence>

      {/* Part 3: Swing & Groove Kinematics */}
      <Sequence from={1800} durationInFrames={750}>
        <CalloutCard
          badge="GROOVE TIMING"
          stepNumber={3}
          totalSteps={3}
          title="Pocket Swing & Shuffle Feel"
          subtitle="Dial in subtle swing percentage to transform robotic grids into humanized rhythm."
          durationInFrames={750}
        />
      </Sequence>

      {/* Outro */}
      <Sequence from={2550} durationInFrames={150}>
        <TitleCardLockup
          kicker="TRY IN STUDIO"
          title="Load Polyrhythm Grid Preset"
          subtitle="Experience this drum groove live in SonicBlueprint Studio."
          durationInFrames={150}
        />
      </Sequence>
    </div>
  );
};
