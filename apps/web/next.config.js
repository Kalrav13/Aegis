/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@testlens/contracts"],
  async rewrites() {
    let apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace(/\s+/g, '');
    apiUrl = apiUrl.replace(/\/$/, '');
    // Normalize duplicate segments
    apiUrl = apiUrl.replace(/\/api\/v1\/api\/v1$/, '/api/v1');
    apiUrl = apiUrl.replace(/\/api\/api$/, '/api');
    const cleanApiUrl = apiUrl;
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
        source: '/auth/:path*',
        destination: `${cleanApiUrl}/auth/:path*`,
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
