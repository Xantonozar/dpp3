import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  // Lint + typecheck run as separate CI steps (npm run lint, npm run typecheck).
  // Skipped inside the build worker: this machine's worker IPC is unstable
  // (exit 3221225477) while both checks pass standalone.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
