# BaseFundAI

BaseFundAI is a Vite + React crowdfunding app backed by an onchain campaign factory, The Graph indexing, and a lightweight trust engine.

## Runtime Architecture

- `src/`: frontend application
- `server/`: trust engine API and campaign metadata registry
- `dist/`: production frontend build output

The Node server can now:

- expose `/api/trust/*`, `/api/campaigns/*`, and `/api/metadata/upload`
- serve the built frontend from `dist/` in production

That means public testnet can be deployed as:

1. One combined Node deployment serving both UI and API from the same origin
2. Separate frontend/backend deployments, with `VITE_API_BASE_URL` pointing at the backend

## Environment Variables

Copy `.env.example` to `.env` and fill the real values:

- `VITE_API_BASE_URL`
- `VITE_DEV_API_PROXY`
- `VITE_GRAPH_API_URL`
- `VITE_GRAPH_API_URL_BASE_SEPOLIA`
- `VITE_GRAPH_API_URL_ARC_TESTNET`
- `VITE_ARC_RPC_URL`
- `TRUST_PORT`
- `TRUST_ALLOWED_ORIGIN`
- `CAMPAIGN_REGISTRY_DB_PATH`
- `ALCHEMY_RPC_URL`
- `ETHERSCAN_API_URL`
- `ETHERSCAN_API_KEY`
- `PINATA_JWT` or `PINATA_API_KEY` + `PINATA_SECRET_API_KEY`
- `MEDIA_STORAGE_PROVIDER`
- `LOCAL_MEDIA_STORAGE_PATH`
- `LOCAL_MEDIA_PUBLIC_BASE_URL`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_BASE_URL`
- `GITCOIN_API_KEY`
- `GITCOIN_SCORER_ID`
- `GEMINI_API_KEY`
- `GEMINI_MODEL`

## Local Development

Frontend:

```powershell
npm run dev
```

Trust server:

```powershell
npm run trust-server
```

## Production / Public Testnet

Build the frontend:

```powershell
npm run build
```

Start the combined server:

```powershell
npm start
```

Recommended production setup:

- deploy the Node server with persistent storage for `server/data`
- use the SQLite registry file at `CAMPAIGN_REGISTRY_DB_PATH` on persistent storage
- configure dedicated Graph endpoints per supported chain when available
- configure the Arc RPC with `VITE_ARC_RPC_URL` if you are not using the default public endpoint
- keep metadata JSON on IPFS and move campaign images to object storage such as Cloudflare R2
- for no-extra-cost hosting, you can keep metadata JSON on Pinata/IPFS and store images on local VPS disk with `MEDIA_STORAGE_PROVIDER=local`
- when using local image storage, the server will serve files from `LOCAL_MEDIA_STORAGE_PATH` at `LOCAL_MEDIA_PUBLIC_BASE_URL`
- set `MEDIA_STORAGE_PROVIDER=r2` only after all `R2_*` credentials and the public media domain are configured
- keep frontend and API on the same domain when possible
- leave `VITE_API_BASE_URL` empty in production when the same server hosts both UI and API
- set `TRUST_ALLOWED_ORIGIN` only if frontend and backend are split across domains
- keep campaign registry records keyed by chain and campaign address in one shared backend

## Launch Checklist

- No secrets in frontend code
- Trust API reachable from the deployed frontend
- Pinata credentials configured only on the server
- Media storage configured with `MEDIA_STORAGE_PROVIDER=r2` and a public `R2_PUBLIC_BASE_URL` when using R2
- Graph endpoints set for Base Sepolia and Arc Testnet indexes
- Persistent storage enabled for `server/data`
- Campaign registry DB persisted across deploys
- Health check responding at `/api/health`
- Frontend built before starting the Node server
