import React from "react";
import { interpolate, useCurrentFrame } from "remotion";

interface AgentCursorProps {
  startX: number; // percentage
  startY: number; // percentage
  endX: number;   // percentage
  endY: number;   // percentage
  clickFrame?: number; // frame at which click occurs
  startFrame?: number;
  durationInFrames: number;
}

export const AgentCursor: React.FC<AgentCursorProps> = ({
  startX,
  startY,
  endX,
  endY,
  clickFrame = 30,
  startFrame = 0,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(frame, [startFrame, startFrame + 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const x = interpolate(progress, [0, 1], [startX, endX]);
  const y = interpolate(progress, [0, 1], [startY, endY]);

  // Click squash
  const isClicking = frame >= clickFrame && frame <= clickFrame + 5;
  const cursorScale = isClicking ? 0.82 : 1.0;

  // Ripple expansion after click
  const rippleProgress = interpolate(frame, [clickFrame, clickFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleRadius = interpolate(rippleProgress, [0, 1], [0, 36]);
  const rippleOpacity = interpolate(rippleProgress, [0, 0.7, 1], [0.8, 0.4, 0]);

  // Fade out cursor at end of duration
  const opacity = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-2px, -2px)",
        pointerEvents: "none",
        zIndex: 60,
        opacity,
      }}
    >
      {/* Click ripple circle */}
      {frame >= clickFrame && frame <= clickFrame + 20 && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: rippleRadius * 2,
            height: rippleRadius * 2,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "2px solid #38bdf8",
            opacity: rippleOpacity,
            backgroundColor: "rgba(56, 189, 248, 0.2)",
          }}
        />
      )}

      {/* SVG Mouse Pointer */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{
          transform: `scale(${cursorScale})`,
          transition: "transform 0.08s ease-out",
          filter: "drop-shadow(0 4px 8px rgba(0, 0, 0, 0.5))",
        }}
      >
        <path
          d="M3 3L10.07 20.97L13.58 13.58L20.97 10.07L3 3Z"
          fill="#38bdf8"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};
