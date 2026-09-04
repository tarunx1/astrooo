import type { NextConfig } from "next";
import { staticSecurityHeaders } from "./src/lib/security/headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "plus.unsplash.com",
      },
    ],
  },
  // Applied to every response, including the static assets the proxy skips.
  // The Content-Security-Policy itself is set in proxy.ts because it carries a
  // per-request nonce.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: staticSecurityHeaders({ isProduction }),
      },
    ];
  },
};

export default nextConfig;
