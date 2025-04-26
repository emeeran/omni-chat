/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Environment variables should be defined in .env files, not here
  async rewrites() {
    // Default to port 5000, but allow configuration via environment variable
    const apiPort = process.env.API_PORT || 5000;
    const baseUrl = process.env.API_URL || `http://localhost:${apiPort}`;
    console.log(`API requests will be proxied to: ${baseUrl}`);

    return [
      {
        source: '/api/:path*',
        destination: `${baseUrl}/api/:path*`,
      }
    ];
  },
};

module.exports = nextConfig;