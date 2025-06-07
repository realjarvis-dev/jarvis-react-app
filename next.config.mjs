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
    optimizeCss: true,
    optimizePackageImports: ['@ai-sdk/react', '@privy-io/react-auth', 'ethers', 'axios']
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
