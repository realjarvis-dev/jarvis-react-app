/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000,
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
        pathname: '/a/**'
      },
      {
        protocol: 'https',
        hostname: 'encrypted-tbn0.gstatic.com',
        port: '',
        pathname: '/**'
      }
    ]
  },
  compress: true,
  swcMinify: true,
  poweredByHeader: false,
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: ['@ai-sdk/react', '@privy-io/react-auth', 'ethers', 'axios', 'recharts', 'lodash'],
    serverComponentsExternalPackages: ['@ai-sdk/anthropic', 'ethers', 'alchemy-sdk'],
    // Reduce server bundle size for faster cold starts
    outputFileTracingIncludes: {
      '/api/**/*': ['./lib/**/*']
    }
  },
  // Optimize for slow networks
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  },
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Aggressive tree shaking for smaller bundles
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        splitChunks: {
          chunks: 'all',
          minSize: 20000,
          maxSize: 200000, // Limit chunk size for faster loading on slow networks
          cacheGroups: {
            default: {
              minChunks: 2,
              priority: -20,
              reuseExistingChunk: true
            },
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'async', // Make vendor chunk async too
              priority: 10,
              maxSize: 150000 // Smaller vendor chunks
            },
            web3: {
              test: /[\\/]node_modules[\\/](ethers|@privy-io|@alchemy)[\\/]/,
              name: 'web3',
              chunks: 'async',
              priority: 30,
              maxSize: 100000
            },
            ai: {
              test: /[\\/]node_modules[\\/](@ai-sdk|openai)[\\/]/,
              name: 'ai', 
              chunks: 'async',
              priority: 30,
              maxSize: 100000
            },
            ui: {
              test: /[\\/]node_modules[\\/](@radix-ui|lucide-react|recharts)[\\/]/,
              name: 'ui',
              chunks: 'async',
              priority: 25,
              maxSize: 80000
            }
          }
        }
      }
    }
    return config
  }
}

export default nextConfig
