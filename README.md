# 0GClawForge

0GClawForge is a sovereign agent OS built on the 0G ecosystem. It lets users mint, orchestrate, own (as ERC-7857 iNFTs), persist, and evolve multi-agent civilizations that run verifiable TEE inference via 0G Compute, store long-term memory forever on 0G Storage, and execute autonomous on-chain actions with zero context loss. Eternal Clans is the flagship application: tradable AI civilizations where players co-create UGC realms, govern evolution through community votes, coordinate DePIN data, and deploy live chat agents — all in one living, self-evolving digital nation.

**Live:** [https://0gclawforge.duckdns.org](https://0gclawforge.duckdns.org)

## Features

### Wallet Connect (RainbowKit)
- Multi-wallet support via RainbowKit (MetaMask, WalletConnect QR, Coinbase Wallet, and more)
- Chain switching between 0G Galileo Testnet (16602) and 0G Mainnet (16661)
- Real on-chain transactions for every action

### Mint Clan iNFT
- Upload clan metadata and initial memory to 0G Storage
- Mint the entire multi-agent civilization as a single ERC-7857 iNFT
- Memory root, realm root, and metadata hash stored on-chain
- Token ID auto-fills for all subsequent actions

### UGC Realm Generation (0G Compute Inference)
- Realm prompts are processed through real 0G Compute verifiable inference
- Returns unique lore, biomes, NPCs, quests, and artifacts per prompt
- Generated realm artifacts persisted permanently on 0G Storage
- Realm root updated on-chain via contract call

### Community Governance (Votes)
- Evolution proposals stored as permanent records on 0G Storage
- Vote roots updated on-chain with full proposal history
- Immutable governance trail for every clan

### Live Clan Dashboard
- **DePIN Integration:** Live WeatherXM network data pulls (station counts, data quality, active devices)
- **Telegram Bot:** Slash commands for `/status`, `/quest`, `/depin`, `/proposal` — real long-polling bot
- **Discord Bot:** Gateway-connected bot with slash commands, guild member summary, and channel posting
- **Autonomous Quest Engine:** Loads real memory context from 0G Storage, incorporates live DePIN data, runs quest through 0G Compute inference, writes result back as permanent memory
- **Runtime Controls:** Deploy, stop, refresh, and monitor the live clan runtime from the dashboard

### Evolution (On-Chain)
- Records clan evolution on-chain with real wallet address as executor
- Realm regeneration through 0G Compute inference during evolution
- Memory root, realm root, metadata hash, and realm count all updated atomically

### Marketplace
- Browse listed clans with name, archetype, model type, and price
- Buy clans through the AgentMarketplace contract (`buyAgent`) with real OG payment
- Seller receives payment minus marketplace fee
- Buyer inherits the clan, its memory, realms, and full history

### Trade
- List clan iNFT for sale directly from the app
- Delist at any time
- Price set in OG tokens

## Architecture

```
0gclawforge/
  agents/               Autonomous runtime, quest engine, DePIN client, social bots
  storage/              Permanent 0G memory/log wrapper (PermanentMemory)
  compute/              TEE-verifiable 0G inference wrapper (VerifiableInference)
  packages/contracts/   ERC-7857 clan iNFT, marketplace, registry, oracle
  packages/sdk/         Typed 0G Storage, Compute, Memory, iNFT primitives
  packages/shared/      Product constants, network config, shared types
  apps/dashboard/       Next.js production app with five tabs + marketplace
  scripts/              Deploy and verification scripts
```

### Key SDK Stack
- **0G Storage:** `@0gfoundation/0g-ts-sdk` via `Indexer` class — all uploads go through `packages/sdk/src/storage.ts`
- **0G Compute:** `@0glabs/0g-serving-broker` via `createZGComputeNetworkBroker` — all inference goes through `packages/sdk/src/compute.ts`
- **Smart Contracts:** ERC-7857 (ERC-721 + encrypted metadata) on 0G Chain

## 0G Testnet Endpoints (Galileo)

| Endpoint | URL |
|---|---|
| RPC | `https://evmrpc-testnet.0g.ai` |
| Storage Indexer (Turbo) | `https://indexer-storage-testnet-turbo.0g.ai` |
| Faucet | `https://faucet.0g.ai` |
| Explorer | `https://chainscan-galileo.0g.ai` |
| Chain ID | `16602` |

## Quick Start (Local Dev)

```bash
pnpm install
cp .env.example .env
# Fill in PRIVATE_KEY with a funded Galileo wallet
pnpm --filter @0gclawforge/agents build
pnpm --filter @0gclawforge/dashboard dev
```

Open `http://localhost:3000`.

## VPS Deployment

The app includes long-lived bot processes (Telegram polling, Discord gateway, autonomous loop) that require a persistent server.

### Requirements
- Ubuntu 22.04+, 2 vCPU / 4 GB RAM minimum
- Node.js 20, pnpm, pm2, nginx

### Steps

```bash
# Clone and install
cd /var/www
git clone https://github.com/0gclawforge/0gclawforge.git
cd 0gclawforge
pnpm install --no-frozen-lockfile

# Configure
cp .env.example .env
nano .env  # Fill all values

# Build
pnpm --filter @0gclawforge/agents build
pnpm --filter @0gclawforge/dashboard build

# Start with PM2
cd apps/dashboard
pm2 start './node_modules/.bin/next start -H 127.0.0.1 -p 3002' --name 0gclawforge
pm2 save && pm2 startup

# Nginx reverse proxy + SSL
# See deployment guide for full nginx config and certbot setup
```

### Update Deployment

```bash
cd /var/www/0gclawforge
git pull
pnpm install --no-frozen-lockfile
pnpm --filter @0gclawforge/agents build
pnpm --filter @0gclawforge/dashboard build
pm2 restart 0gclawforge
```

## Environment Variables

See [.env.example](.env.example). Key variables:

| Variable | Purpose |
|---|---|
| `PRIVATE_KEY` | Funded wallet for 0G Storage uploads and Compute |
| `NEXT_PUBLIC_OG_RPC_URL` | 0G chain RPC endpoint |
| `NEXT_PUBLIC_OG_CHAIN_ID` | Chain ID (16602 testnet, 16661 mainnet) |
| `NEXT_PUBLIC_STORAGE_INDEXER` | 0G Storage indexer URL |
| `OG_COMPUTE_PROVIDER_ADDR` | 0G Compute provider address |
| `NEXT_PUBLIC_AGENT_INFT_ADDRESS` | Deployed iNFT contract address |
| `NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS` | Deployed marketplace contract address |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID (optional) |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token from BotFather |
| `TELEGRAM_DEFAULT_CHAT_ID` | Target Telegram chat/group ID |
| `DISCORD_BOT_TOKEN` | Discord bot token |
| `DISCORD_APPLICATION_ID` | Discord application ID |
| `DISCORD_GUILD_ID` | Target Discord server ID |
| `DISCORD_DEFAULT_CHANNEL_ID` | Target Discord channel ID |
| `WEATHERXM_API_BASE` | WeatherXM API base URL |

## Mainnet Swap

1. Change `NEXT_PUBLIC_OG_CHAIN_ID` to `16661`
2. Change `NEXT_PUBLIC_OG_RPC_URL` to `https://evmrpc.0g.ai`
3. Change `NEXT_PUBLIC_OG_EXPLORER` to `https://chainscan.0g.ai`
4. Deploy contracts to mainnet and update addresses in `.env`
5. Rebuild and restart

## Scripts

```bash
pnpm dev                # Start dashboard in dev mode
pnpm build              # Build all workspace packages
pnpm test               # Run tests
pnpm typecheck          # Type check all workspaces
pnpm deploy:testnet     # Deploy contracts to 0G Galileo
pnpm deploy:mainnet     # Deploy contracts to 0G Mainnet
```

## License

MIT
