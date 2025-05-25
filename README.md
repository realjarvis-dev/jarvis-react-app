# Jarvis

A web3 investment agent with a generative UI.


## 🗂️ Overview

- 🛠 [Features](#-features)
- 🧱 [Stack](#-stack)
- 🚀 [Quickstart](#-quickstart)
- ✅ [Verified models](#-verified-models)
- 👥 [Contributing](#-contributing)


## 🛠 Features

### Core Features

- AI-powered search with GenerativeUI
- Natural language question understanding
- Multiple search providers support (Tavily, SearXNG, Exa)
- Model selection from UI (switch between available AI models)
  - Reasoning models with visible thought process
- Automatic embedded wallet creation
- On-chain transaction including transfer and swap
- Interact with several yield protocol

### Authentication

- User authentication powered by [Privy Auth](https://privy.io)
- Supports Email sign-up and sign-in
- Supports Social Login with Google
- Supports External wallet login

### Chat & History

- Chat history functionality (Optional)
- Share search results (Optional)
- Redis support (Local/Upstash)

### AI Providers

The following AI providers are supported:

- OpenAI 


Models are configured in `public/config/models.json`. Each model requires its corresponding API key to be set in the environment variables. See [Configuration Guide](docs/CONFIGURATION.md) for details.

### Search Capabilities

- URL-specific search
- Video search support (Optional)
- SearXNG integration with:
  - Customizable search depth (basic/advanced)
  - Configurable engines
  - Adjustable results limit
  - Safe search options
  - Custom time range filtering


## 🧱 Stack

### Core Framework

- [Next.js](https://nextjs.org/) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - Text streaming / Generative UI

### AI & Search

- [OpenAI](https://openai.com/) - Default AI provider (Optional: Google AI, Anthropic, Groq, Ollama, Azure OpenAI, DeepSeek, Fireworks)
- [Tavily AI](https://tavily.com/) - Default search provider
- Alternative providers:
  - [SearXNG](https://docs.searxng.org/) - Self-hosted search
  - [Exa](https://exa.ai/) - Neural search

### Data Storage

- [Upstash](https://upstash.com/) - Serverless Redis
- [Redis](https://redis.io/) - Local Redis option

### UI & Styling

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework
- [shadcn/ui](https://ui.shadcn.com/) - Re-usable components
- [Radix UI](https://www.radix-ui.com/) - Unstyled, accessible components
- [Lucide Icons](https://lucide.dev/) - Beautiful & consistent icons

### Authentication & Authorization & Wallet Infrastructure

- [Privy](https://www.privy.io/) - User authentication and embedded walleet

### Yield Protocols
- [Pendle](https://docs.pendle.finance/Introduction) - Yield trading protocol
- [Kodiak](https://documentation.kodiak.finance/) - Liquidity hub on Berachain

### On-chain Integration
- [Enso Network](https://docs.enso.build/home) - Tools to interact with DeFi protocols
- [Alchemy](https://www.alchemy.com/) - Balance and token checking

## 🚀 Quickstart

### 1. Clone repo

```bash
git clone https://github.com/kirastudio-ai/Jarvis-investment-agent.git
```

### 2. Install dependencies

```bash
cd Jarvis-investment-agent
bun install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in the required environment variables in `.env.local`:

```bash
# Required for Core Functionality

ETH_RPC_URL=        # Get from customized rpc provider or local forked mainnet
NEXT_PUBLIC_TEST_NET_ENV=production | development
ALCHEMY_API_KEY=    # Get from https://www.alchemy.com/
ENSO_API_KEY=       # Get from https://docs.enso.build/home
NEXT_PUBLIC_PRIVY_APP_ID= # Get from https://www.privy.io/
PRIVY_APP_SECRET=   # Get from https://www.privy.io/
PRIVY_SIGNING_KEY=  # Get from https://www.privy.io/
OPENAI_API_KEY=     # Get from https://platform.openai.com/api-keys
TAVILY_API_KEY=     # Get from https://app.tavily.com/home
```

For optional features configuration (Redis, SearXNG, etc.), see [CONFIGURATION.md](./docs/CONFIGURATION.md)

### 4. Run app locally

#### Using Bun

```bash
bun run dev
```

## ✅ Verified model

- OpenAI

  - gpt-4o


## 👥 Contributing

We welcome contributions to Jarvis! Whether it's bug reports, feature requests, or pull requests, all contributions are appreciated.

Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- How to submit issues
- How to submit pull requests
- Commit message conventions
- Development setup
