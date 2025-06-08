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
  experimental: {
    optimizeCss: true,
    scrollRestoration: true,
    optimizePackageImports: ['@ai-sdk/react', '@privy-io/react-auth', 'ethers', 'axios', 'recharts', 'lodash']
  },
  webpack: (config, { dev, isServer }) => {
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
              chunks: 'async', // Load asynchronously to reduce initial bundle
              priority: 20
            },
            ai: {
              test: /[\\/]node_modules[\\/](@ai-sdk|openai)[\\/]/,
              name: 'ai', 
              chunks: 'async', // Load asynchronously to reduce initial bundle
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
