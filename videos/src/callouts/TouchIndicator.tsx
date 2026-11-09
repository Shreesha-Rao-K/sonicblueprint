import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface TouchIndicatorProps {
  x: number; // percentage
  y: number; // percentage
  tapFrame?: number;
  durationInFrames: number;
}

export const TouchIndicator: React.FC<TouchIndicatorProps> = ({
  x,
  y,
  tapFrame = 20,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.5, stiffness: 180 },
  });

  const isTapping = frame >= tapFrame && frame <= tapFrame + 8;
  const tapScale = isTapping ? 0.9 : 1.0;

  // Touch ripple
  const rippleProgress = interpolate(frame, [tapFrame, tapFrame + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rippleRadius = interpolate(rippleProgress, [0, 1], [24, 52]);
  const rippleOpacity = interpolate(rippleProgress, [0, 0.5, 1], [0.7, 0.3, 0]);

  // Exit fade out
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = interpolate(entrance, [0, 1], [0, 1]) * exitOpacity;

  return (
    <div
      style={{
        position: "absolute",
        left: `${x}%`,
        top: `${y}%`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 60,
        opacity,
      }}
    >
      {/* Expanding touch ripple */}
      {frame >= tapFrame && frame <= tapFrame + 18 && (
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
            backgroundColor: "rgba(56, 189, 248, 0.15)",
          }}
        />
      )}

      {/* Main 48px touch disc */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          backgroundColor: "rgba(56, 189, 248, 0.35)",
          border: "2px solid #38bdf8",
          boxShadow: "0 0 16px rgba(56, 189, 248, 0.5)",
          transform: `scale(${entrance * tapScale})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            backgroundColor: "#ffffff",
            boxShadow: "0 0 6px #ffffff",
          }}
        />
      </div>
    </div>
  );
};
