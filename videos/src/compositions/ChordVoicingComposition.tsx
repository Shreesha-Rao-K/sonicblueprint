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
  { startFrame: 60, durationInFrames: 45, anchorX: 42, anchorY: 62, zoom: 2.15 },
  { startFrame: 900, durationInFrames: 45, anchorX: 50, anchorY: 20, zoom: 1.95 },
  { startFrame: 1800, durationInFrames: 45, anchorX: 42, anchorY: 62, zoom: 2.2 },
  { startFrame: 2550, durationInFrames: 45, anchorX: 50, anchorY: 50, zoom: 1.0 },
];

export const ChordVoicingComposition: React.FC = () => {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#06070d", position: "relative" }}>
      <SpringCameraRig keyframes={keyframes}>
        <div style={{ width: 1920, height: 1080, position: "relative" }}>
          <Video
            src={staticFile("tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4")}
            startFrom={3150} // 1:45 mark in review video
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </SpringCameraRig>

      {/* Intro Lockup */}
      <Sequence from={0} durationInFrames={90}>
        <TitleCardLockup
          kicker="DEEP DIVE MASTERCLASS"
          title="Modal Scales & Drop-2 Voicings"
          subtitle="Explore jazz chord extensions, open inversions, and interactive visual fretboard theory."
          durationInFrames={90}
        />
      </Sequence>

      {/* Part 1: Voicing Selector */}
      <Sequence from={90} durationInFrames={810}>
        <CalloutCard
          badge="VOICING ALGEBRA"
          stepNumber={1}
          totalSteps={3}
          title="Selecting Drop-2 Inversions"
          subtitle="Drop-2 voicings drop the 2nd voice from top down an octave, creating open neo-soul spread."
          keyboardShortcut="V"
          durationInFrames={810}
        />
        <FocusHalo
          x={42}
          y={62}
          width={180}
          height={64}
          label="Drop-2 Voicing"
          durationInFrames={810}
        />
        <AgentCursor
          startX={30}
          startY={75}
          endX={42}
          endY={62}
          clickFrame={35}
          durationInFrames={810}
        />
      </Sequence>

      {/* Part 2: Visual Piano and Fretboard */}
      <Sequence from={900} durationInFrames={900}>
        <CalloutCard
          badge="VISUAL THEORY"
          stepNumber={2}
          totalSteps={3}
          title="Piano Roll & Guitar Fretboard Shape"
          subtitle="Real-time visualization shows exact root, 3rd, 5th, 7th, and 9th intervals across the neck."
          durationInFrames={900}
        />
        <FocusHalo
          x={50}
          y={20}
          width={400}
          height={90}
          label="CAGED Fretboard Inspector"
          durationInFrames={900}
        />
      </Sequence>

      {/* Part 3: Modal Transposition */}
      <Sequence from={1800} durationInFrames={750}>
        <CalloutCard
          badge="MODAL HARMONY"
          stepNumber={3}
          totalSteps={3}
          title="Modal Dorian & Mixolydian Loops"
          subtitle="Cycle through E♭ Dorian 9th progressions: E♭maj9 → D♭maj9 → Cm9 → Fm9."
          durationInFrames={750}
        />
      </Sequence>

      {/* Outro */}
      <Sequence from={2550} durationInFrames={150}>
        <TitleCardLockup
          kicker="TRY IN STUDIO"
          title="Explore Neo-Soul 9th Preset"
          subtitle="Click 'Try in Studio' in SonicBlueprint to load these chord voicings instantly."
          durationInFrames={150}
        />
      </Sequence>
    </div>
  );
};
