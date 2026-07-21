import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep native canvas + pdf-parse out of the Turbopack/webpack bundle so
  // Vercel Node can load them at runtime (avoids DOMMatrix crash).
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
