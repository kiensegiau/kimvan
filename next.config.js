/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'i.imgur.com', 'firebasestorage.googleapis.com'],
    unoptimized: true,
  },
  // Exclude problematic modules from the server build
  serverExternalPackages: ['node-apiless-youtube-upload'],
  webpack: (config, { isServer }) => {
    // Loại trừ các thư viện gây lỗi
    config.module.rules.push({
      test: /\.(js|mjs|jsx|ts|tsx)$/,
      include: /node_modules\/node-apiless-youtube-upload/,
      use: 'null-loader',
    });
    
    config.module.unknownContextCritical = false;
    config.module.exprContextCritical = false;
    config.module.unknownContextRegExp = /^(electron)$/;
    config.module.unknownContextCritical = false;
    
    // Only apply this on the server build
    if (isServer) {
      // Keep these modules as external and don't try to bundle them
      config.externals.push('node-apiless-youtube-upload');
    }
    
    return config;
  }
}

module.exports = nextConfig 