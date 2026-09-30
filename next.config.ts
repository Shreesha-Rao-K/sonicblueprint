import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Conservative hardening only. No Content-Security-Policy: Next.js needs
    // inline hydration scripts, and a half-working CSP would be worse than none.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
