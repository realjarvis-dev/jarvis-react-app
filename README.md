# 🤖 Jarvis: Unifying Web3 with Autonomous Agent

![Jarvis User Interface](/public/images/UI.png 'Unifying Web3 with Autonomous Agent')

## 🚀 What is Jarvis?

**Jarvis is pioneering the future of Web3 by creating autonomous financial agents that bridge the gap between human intent and decentralized protocols.**

In a fragmented DeFi landscape with thousands of protocols and complex interactions, Jarvis serves as your unified gateway - an intelligent layer that understands your goals and autonomously orchestrates across the entire Web3 ecosystem to achieve them.

Simply tell Jarvis what you want: _"Earn 3% monthly yield"_, _"Protect my portfolio from volatility"_, or _"Find the best yield for my idle USDC"_. Your autonomous agent then analyzes opportunities across 160+ protocols, constructs optimal strategies, and executes them 24/7 - all through natural conversation.

## ✨ The Vision

### 🌐 **Unifying Fragmented DeFi**

- One interface to access the entire Web3 ecosystem
- No more jumping between protocols or managing multiple positions
- Your agent handles all the complexity behind the scenes

### 🤖 **True Financial Autonomy**

- Agents that act on your behalf, not just respond to commands
- Proactive optimization and rebalancing
- 24/7 monitoring and execution without human intervention

### 🔮 **Intent-Based Web3**

- Move from "how" to "what" - just state your goals
- Natural language replaces complex transactions
- AI translates intent into optimal on-chain actions

### 🛡️ **Democratizing Sophisticated Strategies**

- Institutional-grade portfolio management for everyone
- Access strategies previously available only to whales
- No coding or DeFi expertise required

## 🎬 Experience the Future

```
You: "I want to preserve my wealth and earn steady income"

Jarvis: "I'll create a diversified strategy across multiple protocols to achieve this.
        Here's my recommendation:

        • 30% in RWA yields (tokenized treasuries) - 5.2% APY
        • 25% in blue-chip lending (Aave, Compound) - 3.8% APY
        • 25% in ETH liquid staking derivatives - 4.5% APY
        • 20% in stablecoin liquidity pools - 6.1% APY

        Expected return: 4.7% APY with minimal volatility
        Automatic rebalancing: Daily
        Risk monitoring: Real-time

        Should I deploy this autonomous strategy?"

You: "Yes, go ahead"

Jarvis: "Strategy deployed! I'll manage this 24/7 and notify you of any
        significant changes. Your first yield payment arrives in 24 hours."
```

## 🗂️ Overview

- 🛠 [Features](#-features)
- 🧱 [Stack](#-stack)
- 🚀 [Quickstart](#-quickstart)
- ✅ [Verified models](#-verified-models)
- 🌟 [Why Jarvis?](#-why-jarvis)
- 👥 [Contributing](#-contributing)

## 🛠 Features

### Autonomous Agent Capabilities

- **Multi-Protocol Orchestration** - Seamlessly interact with 160+ DeFi protocols
- **Intent Recognition** - Advanced NLP to understand complex financial goals
- **Strategy Generation** - AI creates custom strategies based on your objectives
- **Autonomous Execution** - Deploy and manage positions without manual intervention
- **Real-time Optimization** - Continuous rebalancing for optimal performance
- **Risk Management** - Proactive monitoring and defensive actions
- **Cross-chain Intelligence** - Find opportunities across all major networks

### Core Infrastructure

- **GenerativeUI Interface** - Dynamic, context-aware responses
- **Natural Language Processing** - Speak human, not code
- **Embedded Wallet System** - Seamless onboarding with no seed phrases
- **Multi-model AI Support** - Leveraging best-in-class language models
- **Real-time Data Aggregation** - Live feeds from across DeFi
- **Smart Contract Automation** - Gas-optimized execution layer

### Authentication & Security

- User authentication powered by [Privy Auth](https://privy.io)
- Email and social login support
- External wallet connections
- Non-custodial architecture - your keys, your crypto
- Audit-first approach to protocol integration

### Advanced Features

- **Portfolio Analytics** - Real-time P&L and risk metrics
- **Strategy Backtesting** - Test strategies against historical data
- **Custom Alerts** - Notifications for important events
- **Tax Optimization** - Track and optimize for tax efficiency
- **Social Strategies** - Learn from successful community strategies

## 🌟 Why Jarvis?

| Traditional DeFi                    | Jarvis Autonomous Agents             |
| ----------------------------------- | ------------------------------------ |
| Navigate 100s of protocols manually | One unified interface to all of DeFi |
| Constant monitoring required        | Autonomous 24/7 management           |
| Complex transactions                | Natural language commands            |
| Miss opportunities while sleeping   | Your agent never sleeps              |
| One protocol at a time              | Orchestrate across 160+ protocols    |
| Technical expertise required        | Anyone can be a DeFi power user      |

## 🧱 Stack

### Core Framework

- [Next.js](https://nextjs.org/) - App Router, React Server Components
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vercel AI SDK](https://sdk.vercel.ai/docs) - Text streaming / Generative UI

### AI & Intelligence Layer

- [OpenAI](https://openai.com/) - Primary language model
- [Tavily AI](https://tavily.com/) - Real-time data search
- Alternative providers:
  - [SearXNG](https://docs.searxng.org/) - Self-hosted search
  - [Exa](https://exa.ai/) - Neural search

### Data Infrastructure

- [Upstash](https://upstash.com/) - Serverless Redis
- [Redis](https://redis.io/) - Local caching option

### UI & Experience

- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [shadcn/ui](https://ui.shadcn.com/) - Composable components
- [Radix UI](https://www.radix-ui.com/) - Accessible primitives
- [Lucide Icons](https://lucide.dev/) - Consistent iconography

### Web3 Infrastructure

- [Privy](https://www.privy.io/) - Authentication and embedded wallets
- [Enso Network](https://docs.enso.build/home) - Multi-protocol integration layer
- [Alchemy](https://www.alchemy.com/) - Blockchain data and infrastructure
- [Li.fi](https://docs.li.fi/) - Multi-chain bridging support

### Integrated Protocols

- [Pendle](https://docs.pendle.finance/Introduction) - Yield tokenization
- [Kodiak](https://documentation.kodiak.finance/) - Berachain liquidity
- 160+ protocols via Enso integration

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

TEST_RPC_URL=        # Get from customized rpc provider or local forked mainnet
NEXT_PUBLIC_TEST_NET_ENV=production | development
ALCHEMY_API_KEY=    # Get from https://www.alchemy.com/
ENSO_API_KEY=       # Get from https://docs.enso.build/home
NEXT_PUBLIC_PRIVY_APP_ID= # Get from https://www.privy.io/
PRIVY_APP_SECRET=   # Get from https://www.privy.io/
PRIVY_SIGNING_KEY=  # Get from https://www.privy.io/
OPENAI_API_KEY=     # Get from https://platform.openai.com/api-keys
TAVILY_API_KEY=     # Get from https://app.tavily.com/home
TENDERLY_ADMIN_RPC_URL= # Get from Tenderly dashboard (required for demo mode wallet funding)
```

For optional features configuration (Redis, SearXNG, etc.), see [CONFIGURATION.md](./docs/CONFIGURATION.md)

### 4. Run app locally

#### Using Bun

```bash
bun run dev
```

#### Using npm

```bash
npm run dev
```

Visit `http://localhost:3000` to experience autonomous Web3!

## ✅ Verified Models

### OpenAI

- gpt-4o (Recommended for production)
- gpt-4o-mini
- gpt-4-turbo

### Coming Soon

- Anthropic Claude
- Google Gemini
- Local models via Ollama

## 🗺️ Roadmap

### Phase 1: Foundation (Completed ✅)

- [x] Core autonomous agent framework
- [x] Multi-protocol integration via Enso
- [x] Natural language understanding
- [x] Embedded wallet infrastructure

### Phase 2: Intelligence (In Progress 🚧)

- [ ] Advanced strategy optimization algorithms
- [ ] Multi-chain agent coordination
- [ ] Backtesting and simulation engine
- [ ] Social strategy marketplace

### Phase 3: Scale (Upcoming 🔮)

- [ ] Mobile companion app
- [ ] Institutional agent features
- [ ] Custom agent training
- [ ] DAO governance integration
- [ ] Cross-chain liquidity aggregation

### Phase 4: Ecosystem (Future 🌟)

- [ ] Agent-to-agent communication protocol
- [ ] Decentralized agent marketplace
- [ ] Custom strategy NFTs
- [ ] Integration with traditional finance

## 📊 Platform Stats

- **160+** Integrated Protocols
- **1000+** Available Strategies
- **99.9%** Uptime

## 👥 Contributing

We're building the future of autonomous Web3 together! We welcome contributions from developers, DeFi experts, and visionaries.

Please see our [Contributing Guide](CONTRIBUTING.md) for details on:

- Submitting issues and feature requests
- Development workflow
- Code standards and review process
- Testing requirements
- Documentation guidelines

### Development Setup

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add autonomous feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Areas for Contribution

- 🤖 Agent intelligence improvements
- 🔗 New protocol integrations
- 🎨 UI/UX enhancements
- 📚 Documentation and tutorials
- 🧪 Testing and QA
- 🌍 Localization

## 🔗 Links

- [Website](https://www.thejarvis.xyz)

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

For attribution and modification details, see the [NOTICE](NOTICE) file.

## 🤝 Acknowledgments

Special thanks to the Enso Network team, our protocol partners, and the entire DeFi community for making unified Web3 possible.

## 👥 Contributors

### Jarvis Contributors

Thanks to everyone who has contributed to the Jarvis autonomous agent platform!

- allen@thejarvis.xyz
- rui@thejarvis.xyz
- gaurav@thejarvis.xyz

### Original Project

Jarvis was originally forked from [[Morphic](https://github.com/miurla/morphic)] and has since evolved into a completely different platform focused on autonomous Web3 agents. We acknowledge the foundational work of the original contributors.

---

<div align="center">
  <h3>Ready to unlock the full potential of Web3 with autonomous agents?</h3>
  <a href="https://www.thejarvis.xyz">
    <img src="https://img.shields.io/badge/Launch%20Jarvis-🚀-blue?style=for-the-badge" alt="Launch Jarvis">
  </a>
  <br><br>
  <sub>The future of DeFi is autonomous. The future is Jarvis.</sub>
</div>
