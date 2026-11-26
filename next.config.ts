import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep server-side date operations aligned with Indian Standard Time.
  // Browser-side formatting should still specify Asia/Kolkata explicitly.
  env: {
    TZ: "Asia/Kolkata",
  },
};

export default nextConfig;
