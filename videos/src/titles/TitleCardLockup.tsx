import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface TitleCardLockupProps {
  kicker?: string;
  title: string;
  subtitle: string;
  chapterNumber?: number;
  durationInFrames: number;
}

export const TitleCardLockup: React.FC<TitleCardLockupProps> = ({
  kicker = "SONICBLUEPRINT STUDIO MASTERCLASS",
  title,
  subtitle,
  chapterNumber,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 16, mass: 0.9, stiffness: 110 },
  });

  const lineWidth = interpolate(frame, [10, 35], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const exitOpacity = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = interpolate(entrance, [0, 1], [0, 1]) * exitOpacity;
  const translateY = interpolate(entrance, [0, 1], [25, 0]);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(6, 7, 13, 0.92)",
        backdropFilter: "blur(20px)",
        zIndex: 100,
        opacity,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          transform: `translateY(${translateY}px)`,
          maxWidth: 900,
          padding: 32,
          textAlign: "center",
        }}
      >
        {/* Kicker badge */}
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#38bdf8",
            marginBottom: 12,
          }}
        >
          {chapterNumber ? `CHAPTER ${chapterNumber} • ${kicker}` : kicker}
        </div>

        {/* Title */}
        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            color: "#ffffff",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {title}
        </h1>

        {/* Animated gradient divider line */}
        <div
          style={{
            height: 3,
            width: `${lineWidth}%`,
            maxWidth: 280,
            background: "linear-gradient(90deg, #38bdf8, #818cf8)",
            margin: "18px 0 14px 0",
            borderRadius: 2,
          }}
        />

        {/* Subtitle */}
        <p
          style={{
            fontSize: 18,
            color: "#94a3b8",
            margin: 0,
            lineHeight: 1.4,
            maxWidth: 640,
          }}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
};
