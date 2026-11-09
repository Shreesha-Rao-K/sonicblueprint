import React from "react";
import { Sequence, staticFile, Video } from "remotion";
import { TouchIndicator } from "../callouts/TouchIndicator.js";
import { TitleCardLockup } from "../titles/TitleCardLockup.js";

export const MobileReelComposition: React.FC = () => {
  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: "#06070d",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* Background ambient radial glow */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          width: 900,
          height: 900,
          transform: "translate(-50%, -50%)",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, rgba(6, 7, 13, 0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top Headline Lockup */}
      <div
        style={{
          position: "absolute",
          top: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 30,
          padding: "0 40px",
        }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "#38bdf8",
            display: "block",
            marginBottom: 8,
          }}
        >
          MOBILE TOUCH WORKSTATION
        </span>
        <h1
          style={{
            fontSize: 48,
            fontWeight: 900,
            color: "#ffffff",
            margin: 0,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          Make Music Anywhere
        </h1>
        <p style={{ fontSize: 20, color: "#94a3b8", marginTop: 8 }}>
          Zero install • 48px touch targets • Pro sound
        </p>
      </div>

      {/* Centered Device Viewport Stage */}
      <div
        style={{
          width: 720,
          height: 1200,
          borderRadius: 48,
          border: "4px solid rgba(56, 189, 248, 0.4)",
          boxShadow: "0 30px 80px rgba(0, 0, 0, 0.9), 0 0 40px rgba(56, 189, 248, 0.2)",
          overflow: "hidden",
          position: "relative",
          backgroundColor: "#090d16",
        }}
      >
        <Video
          src={staticFile("tutorials/SonicBlueprint-Phone-Tutorial-REVIEW.mp4")}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {/* Dynamic touch interactions */}
        <Sequence from={150} durationInFrames={60}>
          <TouchIndicator x={50} y={40} tapFrame={20} durationInFrames={60} />
        </Sequence>
        <Sequence from={450} durationInFrames={60}>
          <TouchIndicator x={30} y={65} tapFrame={20} durationInFrames={60} />
        </Sequence>
        <Sequence from={750} durationInFrames={60}>
          <TouchIndicator x={60} y={55} tapFrame={20} durationInFrames={60} />
        </Sequence>
        <Sequence from={1200} durationInFrames={60}>
          <TouchIndicator x={50} y={75} tapFrame={20} durationInFrames={60} />
        </Sequence>
      </div>

      {/* Bottom CTA Glass Card */}
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 60,
          right: 60,
          padding: "24px 32px",
          borderRadius: 24,
          backgroundColor: "rgba(10, 14, 26, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6)",
          zIndex: 30,
        }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", textTransform: "uppercase" }}>
            SonicBlueprint DAW
          </span>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
            Free In-Browser Studio
          </div>
          <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>
            sonicblueprint.com
          </div>
        </div>

        <div
          style={{
            backgroundColor: "#38bdf8",
            color: "#06070d",
            padding: "12px 24px",
            borderRadius: 14,
            fontSize: 16,
            fontWeight: 800,
            letterSpacing: "0.02em",
          }}
        >
          Open App →
        </div>
      </div>

      {/* Intro sequence */}
      <Sequence from={0} durationInFrames={60}>
        <TitleCardLockup
          kicker="VERTICAL REEL"
          title="SonicBlueprint Mobile DAW"
          subtitle="Touch-first music production with pro synth sound."
          durationInFrames={60}
        />
      </Sequence>
    </div>
  );
};
