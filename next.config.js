/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@napi-rs/canvas', '@prisma/client'],
  },
  images: { domains: ['localhost'] },
};
module.exports = nextConfig;
