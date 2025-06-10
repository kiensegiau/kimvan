/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'i.imgur.com', 'firebasestorage.googleapis.com'],
  },
  // Exclude problematic modules from the server build
  experimental: {
    serverComponentsExternalPackages: ['node-apiless-youtube-upload']
  },
  webpack: (config, { isServer }) => {
    // Loại trừ các thư viện gây lỗi
    config.module = {
      ...config.module,
      exprContextCritical: false,
      unknownContextCritical: false
    };
    
    // Only apply this on the server build
    if (isServer) {
      // Keep these modules as external and don't try to bundle them
      config.externals.push('node-apiless-youtube-upload');
    }
    
    return config;
  }
}

module.exports = nextConfig 