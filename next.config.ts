import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The driver app now lives at /rider — keep old links working.
  async redirects() {
    return [{ source: "/driver", destination: "/rider", permanent: true }];
  },
};

export default nextConfig;
