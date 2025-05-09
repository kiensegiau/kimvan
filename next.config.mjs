/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure proper handling of middleware
  skipMiddlewareUrlNormalize: true,
  
  // Basic config options
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Tắt tối ưu CSS để tránh lỗi lightningcss
  experimental: {
    optimizeCss: false
  }
};

export default nextConfig;
