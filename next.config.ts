import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The driver app now lives at /rider — keep old links working.
  async redirects() {
    return [{ source: "/driver", destination: "/rider", permanent: true }];
  },
  // The site's front door is the customer app (splash → phone login); the URL stays "/".
  // Riders and admins use /rider and /admin.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/customer" }], afterFiles: [], fallback: [] };
  },
};

export default nextConfig;
