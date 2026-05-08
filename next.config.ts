import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(nextConfig, {
      silent: true,
      disableLogger: true,
    })
  : nextConfig;
