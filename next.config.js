/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['canvas', '@prisma/client'],
  },
  images: {
    domains: ['localhost'],
  },
};

module.exports = nextConfig;
