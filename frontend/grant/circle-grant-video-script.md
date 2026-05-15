# BaseFundAI Circle Grant Demo Script

Target length: 4:30 to 5:00.

## Recording Setup

Open these before recording:

- Browser: `https://basefundai.tech`
- VS Code: `src/config/networks.js`
- VS Code: `src/config/contracts.js`
- VS Code: `src/components/CreateCampaign.jsx`
- VS Code: `src/components/ContributeBox.jsx`
- VS Code: `server/services/campaignFeed.js`
- Terminal or browser API tabs:
  - `https://basefundai.tech/api/health`
  - `https://basefundai.tech/api/campaigns/summary?chainId=5042002`
  - `https://basefundai.tech/api/campaigns/summary?chainId=84532`
  - `https://basefundai.tech/api/campaigns/summary?chainId=46630`

## Script

### 0:00-0:25 - Introduction

Hello, this is BaseFundAI, a stablecoin-native crowdfunding protocol for transparent, non-custodial campaign funding.

The public testnet beta is live at `https://basefundai.tech`. It currently supports Arc Testnet, Base Sepolia, and Robinhood Testnet.

For this Circle grant submission, I will show the shipped product, the code where USDC and Arc are configured, and the roadmap for deeper Circle developer product integration.

### 0:25-1:15 - Network and USDC Configuration

In `src/config/networks.js`, Arc Testnet is configured with chain ID `5042002` and appears in the supported chain list with Base Sepolia and Robinhood Testnet.

In `src/config/contracts.js`, BaseFundAI maps each chain to the deployed campaign factory contract and funding token.

The current Circle-aligned integration is USDC-denominated campaign funding on Arc Testnet and Base Sepolia. Arc uses the configured USDC token address `0x3600000000000000000000000000000000000000`. Robinhood uses USDG, so I will not describe that as a Circle product integration.

Important clarification: Circle Wallets, CCTP, and Circle Gateway are not currently live in this codebase. They are planned roadmap integrations.

### 1:15-2:00 - Campaign Creation Code

In `src/components/CreateCampaign.jsx`, the product validates the user wallet, supported network, campaign goal, duration, metadata, and trust preview.

When the creator confirms, the frontend calls the deployed factory contract with `createCampaign`, sending the funding goal in stablecoin units and immutable metadata details. The campaign is created on the selected supported testnet.

### 2:00-2:55 - Contribution Flow Code

In `src/components/ContributeBox.jsx`, the contributor flow first checks the connected wallet and selected chain.

The app resolves the funding token for the selected chain, checks the contributor balance, checks allowance, calls ERC-20 `approve` when needed, and then calls the campaign contract's `contribute` function.

This is the core user flow where USDC powers campaign funding on Arc Testnet and Base Sepolia.

### 2:55-3:35 - Backend Indexing and Live Metrics

In `server/services/campaignFeed.js`, the backend combines subgraph data, RPC reads, registry metadata, and contributor statistics into the campaign feed and summary APIs.

This powers the homepage and Explore page stats. Current live public testnet API metrics show:

- Arc Testnet: 3 campaigns, 3 backers, 55 raised
- Base Sepolia: 8 campaigns, 13 backers, 592 raised
- Robinhood Testnet: 3 campaigns, 3 backers, 85 raised

These are testnet metrics, not real-money mainnet volume.

### 3:35-4:30 - Live Product Demonstration

Now I will switch to `https://basefundai.tech`.

Show:

1. Homepage loads over HTTPS.
2. Network selector includes Arc Testnet, Base Sepolia, and Robinhood Testnet.
3. Explore page shows campaign discovery and filters.
4. Campaign detail page shows raised amount, backers, campaign state, metadata, and trust context.
5. Contribution panel shows stablecoin contribution UX.

If test tokens are available, show a small Arc Testnet contribution. If not, show the flow up to wallet confirmation and cancel before signing.

### 4:30-5:00 - Roadmap and Close

The next roadmap is to deepen Arc-native USDC crowdfunding, harden indexing and monitoring, and integrate additional Circle developer products.

Planned integrations include Circle Wallets for easier onboarding, CCTP for cross-chain USDC movement, and Circle Gateway if it fits the production architecture.

This grant would help move BaseFundAI from a working public testnet beta into a more reliable, Arc-first, USDC-native crowdfunding protocol.

