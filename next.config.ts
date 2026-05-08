import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

const configWithAnalyzer = withBundleAnalyzer(nextConfig);

export default process.env.NEXT_PUBLIC_SENTRY_DSN
  ? withSentryConfig(configWithAnalyzer, {
      silent: true,
      disableLogger: true,
    })
  : configWithAnalyzer;
