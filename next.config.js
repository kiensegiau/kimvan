/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'i.imgur.com', 'firebasestorage.googleapis.com'],
  },
  webpack: (config, { isServer }) => {
    // Loại trừ các thư viện gây lỗi
    config.module = {
      ...config.module,
      exprContextCritical: false,
      unknownContextCritical: false
    };
    
    return config;
  }
}

module.exports = nextConfig 