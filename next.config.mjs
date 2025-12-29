import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**'
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**' // Google user content often follows this pattern
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        port: '',
        pathname: '/**' // Allow any path from this hostname
      }
    ]
  },
  experimental: {
    optimizeCss: true
  },
  // Ensure certain ESM crypto/web3 packages are transpiled by Next to avoid bundling issues
  transpilePackages: [
    '@solana/web3.js',
    '@noble/curves',
    '@noble/hashes',
    '@privy-io/react-auth',
    '@bitcoinerlab/secp256k1',
    'bip322-js',
    '@reown/appkit',
    '@reown/appkit-siwx'
  ],
  webpack: (config, { dev, isServer }) => {
    // Dedupe noble packages to a single version to avoid ESM import shape mismatches
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // exact-match package roots only. keep subpath imports (e.g. /ed25519, /secp256k1) intact
      '@noble/curves$': require.resolve('@noble/curves'),
      '@noble/hashes$': require.resolve('@noble/hashes'),
      // also explicitly map deep subpaths used by deps so webpack doesn't miss them
      '@noble/curves/secp256k1': require.resolve('@noble/curves/secp256k1.js'),
      '@noble/curves/abstract/modular': require.resolve('@noble/curves/abstract/modular.js'),
      '@noble/curves/abstract/utils': require.resolve('@noble/curves/abstract/utils.js'),
      '@noble/curves/ed25519': require.resolve('@noble/curves/ed25519.js'),
      '@noble/hashes/sha256': require.resolve('@noble/hashes/sha256.js')
    }

    if (!dev && !isServer) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10
            },
            web3: {
              test: /[\\/]node_modules[\\/](ethers|@privy-io|@alchemy)[\\/]/,
              name: 'web3',
              chunks: 'all',
              priority: 20
            },
            ai: {
              test: /[\\/]node_modules[\\/](@ai-sdk|openai)[\\/]/,
              name: 'ai',
              chunks: 'all',
              priority: 20
            }
          }
        }
      }
    }
    return config
  }
}

export default nextConfig
