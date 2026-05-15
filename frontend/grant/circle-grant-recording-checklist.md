# Circle Grant Recording Checklist

## Must Say Clearly

- BaseFundAI is live as a public testnet beta.
- Arc Testnet is live, chain ID `5042002`.
- Current Circle-aligned integration is USDC-denominated funding on Arc Testnet and Base Sepolia.
- Circle Wallets, CCTP, and Gateway are planned, not currently live.
- Traction numbers are testnet metrics, not mainnet revenue or AUM.

## Must Show In Code

- `src/config/networks.js`: Arc Testnet and supported chains.
- `src/config/contracts.js`: USDC token config and campaign factory addresses.
- `src/components/CreateCampaign.jsx`: `createCampaign` contract call.
- `src/components/ContributeBox.jsx`: ERC-20 `approve`, campaign `contribute`, optional platform token transfer.
- `server/services/campaignFeed.js`: live feed/summary API aggregation.

## Must Show In Product

- `https://basefundai.tech`
- Homepage stats.
- Explore page.
- Network switcher with Arc Testnet.
- One campaign detail page.
- Contribution panel.

## Upload

Recommended:

- Record with OBS Studio, Loom, or Windows Game Bar.
- Keep video under 5 minutes.
- Upload as YouTube unlisted or Google Drive private link.
- Paste the link into the grant field.

