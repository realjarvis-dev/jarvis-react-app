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
    optimizePackageImports: ['@ai-sdk/react', '@privy-io/react-auth', 'axios', 'recharts', 'lodash'],
    serverComponentsExternalPackages: ['@ai-sdk/anthropic', 'ethers', 'alchemy-sdk'],
    // Reduce server bundle size for faster cold starts
    outputFileTracingIncludes: {
      '/api/**/*': ['./lib/**/*']
    }
  },
  // Optimize for slow networks (removed standalone output for compatibility)
  async headers() {
    return [
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
      // Simplified optimization to avoid build issues
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'async',
              priority: 10
            },
            web3: {
              test: /[\\/]node_modules[\\/](ethers|@privy-io|@alchemy)[\\/]/,
              name: 'web3',
              chunks: 'async',
              priority: 20
            },
            ai: {
              test: /[\\/]node_modules[\\/](@ai-sdk|openai)[\\/]/,
              name: 'ai', 
              chunks: 'async',
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
