import type { NextConfig } from "next";

// `npm run build:mobile` sets NEXT_PUBLIC_NATIVE_APP=1 to produce a static export (`out/`) that the
// Android apps in `mobile/` bundle. Static exports can't run route handlers or redirects, so that build
// only picks up .tsx route files — leaving out `app/api/**/route.ts`, which the apps never call.
const nativeApp = process.env.NEXT_PUBLIC_NATIVE_APP === "1";

const nextConfig: NextConfig = nativeApp
  ? { output: "export", trailingSlash: false, pageExtensions: ["tsx"] }
  : {
      // The driver app now lives at /rider and the customer app at / — keep old links working.
      async redirects() {
        return [
          { source: "/driver", destination: "/rider", permanent: true },
          { source: "/customer", destination: "/", permanent: true },
        ];
      },
    };

export default nextConfig;
