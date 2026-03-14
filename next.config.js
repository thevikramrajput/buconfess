/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'prisma', '@napi-rs/canvas'],
  images: {
    remotePatterns: [],
  },
};

module.exports = nextConfig;
