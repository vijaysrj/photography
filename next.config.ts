import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every page in the studio is per-request (it reads your login), so we use
  // the classic dynamic rendering model rather than Cache Components.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  poweredByHeader: false,
};

export default nextConfig;
