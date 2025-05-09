/** @type {import('next').NextConfig} */

const JavaScriptObfuscator = require('javascript-obfuscator');

const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['lh3.googleusercontent.com', 'i.imgur.com', 'firebasestorage.googleapis.com'],
  },
  webpack: (config, { dev, isServer }) => {
    // Chỉ áp dụng cho môi trường production và phía client
    if (!dev && !isServer) {
      // Thêm loader để obfuscate code JavaScript
      config.module.rules.push({
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['next/babel'],
          },
        },
      });

      // Thêm plugin để obfuscate code sau khi build
      config.plugins.push({
        apply: (compiler) => {
          compiler.hooks.afterEmit.tap('ObfuscatePlugin', (compilation) => {
            // Obfuscate các file JS trong thư mục build
            const { assets } = compilation;
            const jsFiles = Object.keys(assets).filter(file => file.endsWith('.js'));
            
            jsFiles.forEach(file => {
              const asset = assets[file];
              const code = asset.source();
              
              // Cấu hình obfuscator
              const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.5,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.3,
                debugProtection: true,
                debugProtectionInterval: true,
                disableConsoleOutput: true,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: false,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 5,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayEncoding: ['rc4'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 5,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 5,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 0.8,
                transformObjectKeys: true,
                unicodeEscapeSequence: false
              });
              
              // Thay thế mã nguồn gốc bằng mã đã được obfuscate
              asset.source = () => obfuscationResult.getObfuscatedCode();
            });
          });
        }
      });
    }

    return config;
  },
}

module.exports = nextConfig 