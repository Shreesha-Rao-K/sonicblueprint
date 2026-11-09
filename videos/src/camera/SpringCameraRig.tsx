import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { CameraKeyframe } from "../types.js";

interface SpringCameraRigProps {
  keyframes: CameraKeyframe[];
  children: React.ReactNode;
}

export const SpringCameraRig: React.FC<SpringCameraRigProps> = ({ keyframes, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // Find active keyframe segment
  let currentKeyframe: CameraKeyframe = keyframes[0] ?? {
    startFrame: 0,
    durationInFrames: 30,
    anchorX: 50,
    anchorY: 50,
    zoom: 1.0,
  };
  let nextKeyframe: CameraKeyframe = currentKeyframe;
  let progress = 0;

  for (let i = 0; i < keyframes.length; i++) {
    const kf = keyframes[i];
    if (frame >= kf.startFrame) {
      currentKeyframe = kf;
      nextKeyframe = keyframes[i + 1] ?? kf;
      const localFrame = frame - kf.startFrame;
      progress = spring({
        frame: localFrame,
        fps,
        config: { damping: 200, mass: 1, stiffness: 100 },
        durationInFrames: Math.min(kf.durationInFrames, 30),
      });
    }
  }

  const zoom = interpolate(progress, [0, 1], [currentKeyframe.zoom, nextKeyframe.zoom]);
  const anchorX = interpolate(progress, [0, 1], [currentKeyframe.anchorX, nextKeyframe.anchorX]);
  const anchorY = interpolate(progress, [0, 1], [currentKeyframe.anchorY, nextKeyframe.anchorY]);

  // Compute centered pan offset
  const idealPanX = (anchorX / 100) * width - width / 2;
  const idealPanY = (anchorY / 100) * height - height / 2;

  // Boundary clamping to guarantee canvas borders never pull away from frame
  const maxPanX = Math.max(0, ((zoom - 1) * width) / 2);
  const maxPanY = Math.max(0, ((zoom - 1) * height) / 2);
  const panX = Math.max(-maxPanX, Math.min(maxPanX, idealPanX));
  const panY = Math.max(-maxPanY, Math.min(maxPanY, idealPanY));

  return (
    <div
      style={{
        width,
        height,
        overflow: "hidden",
        position: "relative",
        backgroundColor: "#06070d",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "50% 50%",
          transform: `translate3d(${-panX}px, ${-panY}px, 0px) scale(${zoom})`,
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
};
