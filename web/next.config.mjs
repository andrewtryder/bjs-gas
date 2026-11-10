import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../"),
  turbopack: {
    resolveAlias: {
      "../src/service.js": "../src/service.ts",
      "./stats.js": "./lib/stats.ts",
      "./types.js": "./lib/types.ts",
      "./freshness.js": "./lib/freshness.ts",
      "./states.js": "./lib/states.ts",
    },
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
  async redirects() {
    return [
      {
        source: "/status",
        destination: "/about",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://unpkg.com",
              "font-src 'self' data:",
              "img-src 'self' data: blob: https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://demotiles.maplibre.org",
              "worker-src 'self' blob:",
              "child-src 'self' blob:",
              "connect-src 'self' https://*.basemaps.cartocdn.com https://basemaps.cartocdn.com https://demotiles.maplibre.org https://*.prisma.build https://api.honeybadger.io",
              "frame-ancestors 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
