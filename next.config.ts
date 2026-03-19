import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling packages with native binaries.
  // @libsql/client ships .node files; bundling them breaks Vercel builds.
  serverExternalPackages: ["@libsql/client"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
      { protocol: "http",  hostname: "**" },
    ],
    dangerouslyAllowSVG: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  async redirects() {
    return [
      { source: "/search/treatment", destination: "/treatments", permanent: false },
      { source: "/search/hospital", destination: "/hospitals", permanent: false },
      { source: "/search/doctor", destination: "/hospitals", permanent: false },
      { source: "/search/lab-test", destination: "/treatments", permanent: false },
      { source: "/symptoms", destination: "/treatments", permanent: false },
      { source: "/specialties", destination: "/treatments", permanent: false },
      { source: "/subscription", destination: "/admin", permanent: false },
    ];
  },
};

export default nextConfig;
