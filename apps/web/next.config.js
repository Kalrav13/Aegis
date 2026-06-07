/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@testlens/contracts"],
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
    const cleanApiUrl = apiUrl.replace(/\/$/, '');
    const baseHost = cleanApiUrl.replace(/\/api\/v1$/, '').replace(/\/api$/, '');

    return [
      {
        source: '/projects/:path*',
        destination: `${cleanApiUrl}/projects/:path*`,
      },
      {
        source: '/analyses/:path*',
        destination: `${cleanApiUrl}/analyses/:path*`,
      },
      {
        source: '/api/:path*',
        destination: `${baseHost}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${cleanApiUrl}/health`,
      },
    ];
  }
}

module.exports = nextConfig
