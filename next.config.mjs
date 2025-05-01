/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure proper handling of middleware
  skipMiddlewareUrlNormalize: true,
  
  // Basic config options
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
