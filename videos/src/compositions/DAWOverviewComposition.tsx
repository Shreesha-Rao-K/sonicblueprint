import React from "react";
import { Sequence, staticFile, Video } from "remotion";
import { SpringCameraRig } from "../camera/SpringCameraRig.js";
import { CalloutCard } from "../callouts/CalloutCard.js";
import { FocusHalo } from "../callouts/FocusHalo.js";
import { AgentCursor } from "../callouts/AgentCursor.js";
import { TitleCardLockup } from "../titles/TitleCardLockup.js";
import { PC_COMPOSITION_CHAPTERS } from "../data/chapters-pc.js";

export const DAWOverviewComposition: React.FC = () => {
  const cameraKeyframes = PC_COMPOSITION_CHAPTERS.map((ch) => ch.cameraKeyframe);

  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#06070d", position: "relative" }}>
      {/* Spring camera rig panning and zooming into active controls */}
      <SpringCameraRig keyframes={cameraKeyframes}>
        <div style={{ width: 1920, height: 1080, position: "relative" }}>
          <Video
            src={staticFile("tutorials/SonicBlueprint-PC-Tutorial-REVIEW.mp4")}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </SpringCameraRig>

      {/* Opening Intro Title Card */}
      <Sequence from={0} durationInFrames={90}>
        <TitleCardLockup
          kicker="IN-BROWSER DAW MASTERCLASS"
          title="SonicBlueprint Studio"
          subtitle="A complete guide to modal voicings, polyrhythmic sequencing, and master DSP effects."
          durationInFrames={90}
        />
      </Sequence>

      {/* Chapter Callouts, Focus Halos, and Agent Cursors */}
      {PC_COMPOSITION_CHAPTERS.map((ch) => (
        <Sequence key={ch.id} from={ch.startFrame} durationInFrames={ch.durationInFrames}>
          <CalloutCard
            badge={ch.category}
            stepNumber={ch.chapterNumber}
            totalSteps={PC_COMPOSITION_CHAPTERS.length}
            title={ch.title}
            subtitle={ch.subtitle}
            keyboardShortcut={ch.callout?.keyboardShortcut}
            durationInFrames={ch.durationInFrames}
          />

          {ch.callout && (
            <>
              <FocusHalo
                x={ch.callout.x}
                y={ch.callout.y}
                width={ch.callout.width ?? 160}
                height={ch.callout.height ?? 60}
                label={ch.callout.label}
                durationInFrames={ch.durationInFrames}
              />
              <AgentCursor
                startX={ch.callout.x - 15}
                startY={ch.callout.y + 15}
                endX={ch.callout.x}
                endY={ch.callout.y}
                clickFrame={40}
                durationInFrames={ch.durationInFrames}
              />
            </>
          )}
        </Sequence>
      ))}

      {/* Outro Title Card */}
      <Sequence from={12450} durationInFrames={150}>
        <TitleCardLockup
          kicker="GET STARTED FOR FREE"
          title="Create Your Song in SonicBlueprint"
          subtitle="Zero install. Zero latency. 100% in your browser."
          durationInFrames={150}
        />
      </Sequence>
    </div>
  );
};
