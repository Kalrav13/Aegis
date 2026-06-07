/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@testlens/contracts"],
  async rewrites() {
    return [
      {
        source: '/projects/:path*',
        destination: 'http://localhost:3000/projects/:path*',
      },
      {
        source: '/analyses/:path*',
        destination: 'http://localhost:3000/analyses/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  }
}

module.exports = nextConfig
