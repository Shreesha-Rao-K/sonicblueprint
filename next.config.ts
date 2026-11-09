import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Strict Content Security Policy tailored for offline-first Web Audio DAW
const cspDirectives = [
  "default-src 'self'",
  // Next.js App Router requires 'unsafe-inline' for client hydration scripts.
  // 'wasm-unsafe-eval' enables WebAssembly compilation without opening general JavaScript eval().
  // In development, Turbopack HMR and React Fast Refresh require 'unsafe-eval'.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind CSS v4 and dynamic styles require 'unsafe-inline' for DOM style insertion
  "style-src 'self' 'unsafe-inline'",
  // Visualizer snapshots, OG images, favicons, audio waveform canvases
  "img-src 'self' blob: data:",
  // Font files and inline data fonts
  "font-src 'self' data:",
  // ZERO REMOTE NETWORK DEPENDENCY: strictly restrict network egress to self, blob:, data:
  // In development, permit local WebSocket and HTTP connections for Next.js Fast Refresh
  `connect-src 'self' blob: data:${
    isDev
      ? " ws://localhost:* http://localhost:* ws://127.0.0.1:* http://127.0.0.1:*"
      : ""
  }`,
  // Web Audio sample banks, synthesized WAV/MP3 blob exports, audio preview elements
  "media-src 'self' blob: data:",
  // AudioWorklet nodes and Web Workers spawned via inline Blobs
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  // Disallow all plugins, Flash, Java, object embeds
  "object-src 'none'",
  // Clickjacking mitigation: deny framing from any domain (modern replacement for X-Frame-Options: DENY)
  "frame-ancestors 'none'",
  // Restrict form submissions strictly to same origin
  "form-action 'self'",
  // Disallow <base href="..."> injection hijacking
  "base-uri 'self'",
  // PWA manifest files
  "manifest-src 'self'",
  // Enforce HTTPS upgrade on sub-resources in production
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
];

const cspHeaderValue = cspDirectives.join("; ");

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeaderValue,
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=(), midi=(self)",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "credentialless",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          ...(isDev
            ? []
            : [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]),
        ],
      },
    ];
  },
};

export default nextConfig;
