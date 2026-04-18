import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "ocsyeqloetdcuuofvmuc.supabase.co",
        pathname: "/storage/**",
      },
    ],
  },
};

export default nextConfig;
