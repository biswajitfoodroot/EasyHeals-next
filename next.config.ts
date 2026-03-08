import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "easyheals.com",
      },
    ],
    dangerouslyAllowSVG: true,
  },
};

export default nextConfig;
