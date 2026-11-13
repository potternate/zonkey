import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: { "/r/[slug]/card": ["./assets/fonts/**"] },
};

export default nextConfig;
