import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Remove ignoreBuildErrors — we want real type checking
}

export default nextConfig
