import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const publicDir = path.resolve(__dirname, "../public");

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const workerPath = require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
const sharedPath = require.resolve("maplibre-gl/dist/maplibre-gl-shared.mjs");

fs.copyFileSync(workerPath, path.join(publicDir, "maplibre-gl-worker.mjs"));
fs.copyFileSync(sharedPath, path.join(publicDir, "maplibre-gl-shared.mjs"));
console.log("MapLibre worker scripts copied to web/public/");

// If Next.js standalone directory exists, also populate its public/ and static/ folders
const standaloneWebDir = path.resolve(__dirname, "../.next/standalone/web");
if (fs.existsSync(standaloneWebDir)) {
  const standalonePublic = path.join(standaloneWebDir, "public");
  if (!fs.existsSync(standalonePublic)) {
    fs.mkdirSync(standalonePublic, { recursive: true });
  }
  fs.copyFileSync(workerPath, path.join(standalonePublic, "maplibre-gl-worker.mjs"));
  fs.copyFileSync(sharedPath, path.join(standalonePublic, "maplibre-gl-shared.mjs"));

  const dotNextStatic = path.resolve(__dirname, "../.next/static");
  const standaloneStatic = path.join(standaloneWebDir, ".next/static");
  if (fs.existsSync(dotNextStatic)) {
    fs.cpSync(dotNextStatic, standaloneStatic, { recursive: true });
  }
  console.log("MapLibre worker scripts and static assets copied to standalone directory.");
}
