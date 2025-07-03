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
  serverExternalPackages: ['mongodb'],
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebase.com https://*.google.com https://*.gstatic.com;"
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig 