/** @type {import('next').NextConfig} */

const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'i.imgur.com', 'firebasestorage.googleapis.com'],
  },
  webpack: (config, { isServer }) => {
    // Bỏ qua các module phụ thuộc tùy chọn của MongoDB gây cảnh báo
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'kerberos': false,
      '@mongodb-js/zstd': false,
      '@aws-sdk/credential-providers': false,
      'gcp-metadata': false,
      'snappy': false,
      'aws4': false,
      'mongodb-client-encryption': false
    };
    
    return config;
  },
  // Cấu hình middleware
  serverExternalPackages: ['mongodb']
}

module.exports = nextConfig 