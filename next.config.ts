import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { withSentryConfig } from "@sentry/nextjs/config";

const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  reactCompiler: true,
  compress: true,
  // Required in Next.js 16 — Turbopack is the default; silence the webpack/turbopack conflict
  // error introduced by @ducanh2912/next-pwa injecting a webpack plugin.
  turbopack: {},
  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons", "recharts"],
  },
  // Proxy API calls to the Laravel backend in development
  async rewrites() {
    return process.env.NODE_ENV === "development"
      ? [
          {
            source: "/api/v1/:path*",
            destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/v1/:path*`,
          },
        ]
      : [];
  },
};

// Sentry wraps the config last. Source-map upload only happens when SENTRY_AUTH_TOKEN is set in CI.
export default withSentryConfig(withPWA(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  widenClientFileUpload: true,
});
