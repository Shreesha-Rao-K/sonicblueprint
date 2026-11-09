import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface FocusHaloProps {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  width?: number; // px
  height?: number; // px
  label?: string;
  durationInFrames: number;
}

export const FocusHalo: React.FC<FocusHaloProps> = ({
  x,
  y,
  width = 140,
  height = 56,
  label,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring
  const entrance = spring({
    frame,
    fps,
    config: { damping: 15, mass: 0.6, stiffness: 140 },
  });

  // Micro pulse oscillation (1.5 Hz)
  const pulse = Math.sin((frame / fps) * Math.PI * 3) * 0.04;
  const scale = interpolate(entrance, [0, 1], [0.3, 1.0]) + pulse;

  // Exit fade out
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 12, durationInFrames],
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
        transform: `translate(-50%, -50%) scale(${scale})`,
        width,
        height,
        opacity,
        pointerEvents: "none",
        zIndex: 40,
      }}
    >
      {/* Blooming glowing bounding ring */}
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 10,
          border: "2px solid rgba(56, 189, 248, 0.95)",
          boxShadow: "0 0 24px rgba(56, 189, 248, 0.6), inset 0 0 12px rgba(56, 189, 248, 0.3)",
        }}
      />

      {/* Optional HUD indicator label */}
      {label && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: "50%",
            transform: "translateX(-50%) translateY(-6px)",
            backgroundColor: "rgba(14, 165, 233, 0.95)",
            color: "#ffffff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            boxShadow: "0 4px 10px rgba(0, 0, 0, 0.4)",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
