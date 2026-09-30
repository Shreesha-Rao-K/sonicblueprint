import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BARS = [150, 250, 330, 215, 135];

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 84px",
          backgroundColor: "#06070d",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 22,
              backgroundColor: "#0a0e1a",
              border: "3px solid #1e2a4a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            {BARS.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 10,
                  height: h * 0.2,
                  borderRadius: 5,
                  backgroundColor: i % 2 === 0 ? "#6e8bff" : "#a78bfa",
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 38, fontWeight: 800, letterSpacing: 6, color: "#ffffff" }}>
            SONICBLUEPRINT
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            Design the music.
          </div>
          <div style={{ fontSize: 72, fontWeight: 800, color: "#ffffff", lineHeight: 1.05 }}>
            Build the blueprint.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 30, color: "#94a3b8" }}>
            Chord progressions · Drum patterns · Arrangement · MP3, MIDI &amp; PDF export
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
