# BaseFundAI

BaseFundAI is a trust-aware, non-custodial crowdfunding app for real-world needs.
It lets creators launch transparent onchain campaigns and lets contributors fund
them directly from their wallets using stable assets on supported public testnets.

Live public testnet: https://basefundai.tech

## Current Public Testnet Scope

- Campaign creation through smart contracts
- Campaign discovery, sorting, and status filters
- Campaign detail pages with media, story, progress, backers, and trust context
- Wallet-based contribution flow
- Creator claim flow for successful campaigns
- Contributor refund flow for failed campaigns
- Trust preview and trust badges
- Backend campaign feed, summary, metadata, monitoring, and trust APIs
- Multi-network support for Base Sepolia, Arc Testnet, and Robinhood Testnet

## Repository Layout

- `frontend/` - Vite, React, Node trust engine, campaign APIs, frontend app, and subgraph assets
- `contracts/` - earlier Solidity campaign factory and campaign contracts
- `docs/` - supporting project documents

## Stable Assets

- Base Sepolia: USDC
- Arc Testnet: USDC
- Robinhood Testnet: USDG

## Local Development

```bash
cd frontend
npm install
npm run dev
```

Run the combined trust server:

```bash
cd frontend
npm run trust-server
```

Build for production:

```bash
cd frontend
npm run build
```

## Production

The deployed app uses a combined Node server that serves both the built Vite app
and API routes from the same origin.

Required environment values are documented in `frontend/.env.example`.
