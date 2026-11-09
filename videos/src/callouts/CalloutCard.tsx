import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface CalloutCardProps {
  badge?: string | undefined;
  stepNumber?: number | undefined;
  totalSteps?: number | undefined;
  title: string;
  subtitle: string;
  keyboardShortcut?: string | undefined;
  durationInFrames: number;
}

export const CalloutCard: React.FC<CalloutCardProps> = ({
  badge,
  stepNumber,
  totalSteps,
  title,
  subtitle,
  keyboardShortcut,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Entrance spring animation
  const entrance = spring({
    frame,
    fps,
    config: { damping: 18, mass: 0.8, stiffness: 120 },
  });

  // Exit fade out over last 15 frames
  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Linear progress bar along the bottom of the card
  const progressPct = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(entrance, [0, 1], [40, 0]);
  const opacity = interpolate(entrance, [0, 1], [0, 1]) * exitOpacity;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 36,
        left: "50%",
        transform: `translateX(-50%) translateY(${translateY}px)`,
        opacity,
        width: "90%",
        maxWidth: 760,
        backgroundColor: "rgba(10, 14, 26, 0.88)",
        backdropFilter: "blur(14px)",
        borderRadius: 16,
        border: "1px solid rgba(56, 189, 248, 0.35)",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.15)",
        overflow: "hidden",
        zIndex: 50,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ padding: "16px 22px" }}>
        {/* Header row: Badge, Step, Shortcut */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {stepNumber && totalSteps && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#38bdf8",
                }}
              >
                {stepNumber} / {totalSteps}
              </span>
            )}
            {badge && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  padding: "2px 8px",
                  borderRadius: 6,
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  color: "#7dd3fc",
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                }}
              >
                {badge}
              </span>
            )}
          </div>

          {keyboardShortcut && (
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                padding: "2px 6px",
                borderRadius: 4,
                backgroundColor: "rgba(255, 255, 255, 0.12)",
                color: "#e2e8f0",
                border: "1px solid rgba(255, 255, 255, 0.2)",
              }}
            >
              {keyboardShortcut}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: 18, fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em" }}>
          {title}
        </div>

        {/* Subtitle */}
        <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 2, lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>

      {/* Timeline hairline indicator */}
      <div
        style={{
          height: 3,
          width: `${progressPct}%`,
          background: "linear-gradient(90deg, #38bdf8, #818cf8)",
          transition: "width 0.1s linear",
        }}
      />
    </div>
  );
};
