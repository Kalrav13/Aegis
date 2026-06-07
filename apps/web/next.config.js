/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@testlens/contracts"],
  async rewrites() {
    return [
      {
        source: '/projects/:path*',
        destination: 'http://localhost:3001/api/v1/projects/:path*',
      },
      {
        source: '/analyses/:path*',
        destination: 'http://localhost:3001/api/v1/analyses/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://localhost:3001/api/v1/health',
      },
    ];
  }
}

module.exports = nextConfig
