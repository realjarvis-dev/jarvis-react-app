# Configuration Guide

This guide covers the optional features and their configuration in Jarvis.

## Table of Contents

- [Chat History Storage](#chat-history-storage)
- [Search Providers](#search-providers)
- [Web3 Setup](#web3-setup)
  - [Privy Setup](#privy-setup)
  - [Tenderly Setup](#tenderly-setup)
  - [Alchemy Setup](#alchemy-setup)
  - [Enso Setup](#enso-setup)
- [Additional AI Providers](#additional-ai-providers)
- [Other Features](#other-features)

## Chat History Storage

### Using Upstash Redis (Recommended for production)

Follow the detailed setup guide at [Building your own RAG chatbot with Upstash](https://upstash.com/blog/rag-chatbot-upstash#setting-up-upstash-redis)

1. Create a database at [Upstash Console](https://console.upstash.com/redis)
2. Navigate to the Details tab and find the "Connect your database" section
3. Copy the REST API credentials from the .env section
4. Configure your `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY=true
USE_LOCAL_REDIS=false
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_REDIS_REST_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_REDIS_REST_TOKEN]
```

### Using Local Redis

1. Ensure Redis is installed and running locally
2. Configure your `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_SAVE_CHAT_HISTORY=true
USE_LOCAL_REDIS=true
LOCAL_REDIS_URL=redis://localhost:6379
```

## Search Providers

### SearXNG Configuration

SearXNG can be used as an alternative search backend with advanced search capabilities.

#### Basic Setup

1. Set up SearXNG as your search provider:

```bash
SEARCH_API=searxng
SEARXNG_API_URL=http://localhost:8080
SEARXNG_SECRET=""  # generate with: openssl rand -base64 32
```

#### Docker Setup

1. Ensure you have Docker and Docker Compose installed
2. Two configuration files are provided in the root directory:
   - `searxng-settings.yml`: Contains main configuration for SearXNG
   - `searxng-limiter.toml`: Configures rate limiting and bot detection

#### Advanced Configuration

1. Configure environment variables in your `.env.local`:

```bash
# SearXNG Base Configuration
SEARXNG_PORT=8080
SEARXNG_BIND_ADDRESS=0.0.0.0
SEARXNG_IMAGE_PROXY=true

# Search Behavior
SEARXNG_DEFAULT_DEPTH=basic  # Set to 'basic' or 'advanced'
SEARXNG_MAX_RESULTS=50  # Maximum number of results to return
SEARXNG_ENGINES=google,bing,duckduckgo,wikipedia  # Comma-separated list of search engines
SEARXNG_TIME_RANGE=None  # Time range: day, week, month, year, or None
SEARXNG_SAFESEARCH=0  # 0: off, 1: moderate, 2: strict

# Rate Limiting
SEARXNG_LIMITER=false  # Enable to limit requests per IP
```

#### Advanced Search Features

- `SEARXNG_DEFAULT_DEPTH`: Controls search depth
  - `basic`: Standard search
  - `advanced`: Includes content crawling and relevance scoring
- `SEARXNG_MAX_RESULTS`: Maximum results to return
- `SEARXNG_CRAWL_MULTIPLIER`: In advanced mode, determines how many results to crawl
  - Example: If `MAX_RESULTS=10` and `CRAWL_MULTIPLIER=4`, up to 40 results will be crawled

#### Customizing SearXNG

You can modify `searxng-settings.yml` to:

- Enable/disable specific search engines
- Change UI settings
- Adjust server options

Example of disabling specific engines:

```yaml
engines:
  - name: wikidata
    disabled: true
```

For detailed configuration options, refer to the [SearXNG documentation](https://docs.searxng.org/admin/settings/settings.html#settings-yml)

#### Troubleshooting

- If specific search engines aren't working, try disabling them in `searxng-settings.yml`
- For rate limiting issues, adjust settings in `searxng-limiter.toml`
- Check Docker logs for potential configuration errors:

```bash
docker-compose logs searxng
```

## Web3 Setup

This section covers the setup for essential Web3 services used by Jarvis for authentication, wallet infrastructure, and on-chain interactions. Details for these environment variables can also be found in the main `README.md`.

### Privy Setup

Privy is used for user authentication and embedded wallet management.

1.  Sign up or log in to [Privy](https://www.privy.io/).
2.  Navigate to your dashboard to find your App ID, App Secret, and Signing Key.
3.  Configure your `.env.local` with these credentials:

```bash
# Privy - Authentication & Embedded Wallets
NEXT_PUBLIC_PRIVY_APP_ID= # Get from https://www.privy.io/
PRIVY_APP_SECRET=   # Get from https://www.privy.io/
PRIVY_SIGNING_KEY=  # Get from https://www.privy.io/
```

### Tenderly Setup

Tenderly is used for Virtual Network (VNet) functionality in the demo environment.

1. Create an account or log in at [Tenderly](https://tenderly.co/).
2. Set up a Virtual Network in your Tenderly dashboard.
3. Configure your `.env.local` with the admin RPC URL:

```bash
# Tenderly - Virtual Network for Demo Mode
TENDERLY_ADMIN_RPC_URL=  # Admin RPC URL for your Tenderly Virtual Network
```

This environment variable is required for the wallet funding functionality in demo mode.

### Alchemy Setup

Alchemy is used for balance and token checking on the blockchain.

1.  Create an account or log in at [Alchemy](https://www.alchemy.com/).
2.  Create a new app on your dashboard to get an API Key.
3.  Set the following environment variables in your `.env.local`:

```bash
# Alchemy - Blockchain Data
ALCHEMY_API_KEY=    # Get from https://www.alchemy.com/
```

You will also need to configure an Ethereum RPC URL if you want to use locally forked mainnet.

```bash
ETH_RPC_URL=        # Your Ethereum RPC URL
```

### Enso Setup

Enso provides tools to interact with various DeFi protocols.

1.  Refer to the [Enso documentation](https://docs.enso.build/home) to obtain an API key.
2.  Add the API key to your `.env.local`:

```bash
# Enso - DeFi Protocol Interaction
ENSO_API_KEY=       # Get from https://docs.enso.build/home
```

You should also set the test net environment variable, as mentioned in `README.md`:

```bash
# Controls privy-transfer use sepolia or mainnet
# TODO: make it more general
NEXT_PUBLIC_TEST_NET_ENV=production # or development
```

## Additional AI Providers

Models are configured in `public/config/models.json`. Each model requires its corresponding API key to be set in the environment variables.

### Model Configuration

The `models.json` file contains an array of model configurations with the following structure:

```json
{
  "models": [
    {
      "id": "model-id",
      "name": "Model Name",
      "provider": "Provider Name",
      "providerId": "provider-id",
      "enabled": true,
      "toolCallType": "native|manual",
      "toolCallModel": "tool-call-model-id" // optional, only needed if toolCallType is "manual" and you need to specify a different model for tool calls
    }
  ]
}
```

## Other Features

### Share Feature

```bash
NEXT_PUBLIC_ENABLE_SHARE=true
```

### Video Search

```bash
SERPER_API_KEY=[YOUR_API_KEY]
```

### Alternative Retrieve Tool

```bash
JINA_API_KEY=[YOUR_API_KEY]
```
