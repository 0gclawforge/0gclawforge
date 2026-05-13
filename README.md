# 0GClawForge

0GClawForge is the first complete OpenClaw-powered sovereign agent OS — a forge where teams mint, orchestrate, own (as ERC-7857 iNFTs), persist, and evolve multi-agent systems that run verifiable TEE inference, store long-term memory forever on 0G, and execute autonomous on-chain actions with zero context loss. Built on top, Eternal Clans is the flagship consumer application: tradable AI civilizations where players co-create UGC Gaming realms + SocialFi DAOs + DePIN coordination into one living, self-evolving digital nation.

## Focused MVP

0GClawForge is built around four non-negotiable pillars:

- **Permanent Memory + Verifiable Inference:** 0G Storage persists clan memory and realm history forever; 0G Compute wraps every agent call with TEE-verifiable inference.
- **Mint & Own an Entire Clan as One iNFT:** one ERC-7857 token represents the full multi-agent clan, intelligence blob, memory root, realm roots, vote roots, and transfer history.
- **UGC Realm Co-Creation:** players prompt OpenClaw to generate game realms, NPCs, quests, and artifacts, then store them permanently on 0G.
- **Autonomous Evolution + Trade:** community votes trigger verified OpenClaw evolution, memory updates, realm regeneration, and trade-ready ownership transfer with full history intact.

Phase 2 items such as SocialFi auto-deploy, DePIN data pulls, in-realm quests, and Discord/Telegram bots are intentionally stubbed or documented only. They are not part of the MVP UI flow.

## How the Two Ideas Merge Seamlessly (Stronger Together)

0GClawForge (the OS layer) provides the sovereign agent operating system with permanent 0G memory, TEE-verified inference, and ERC-7857 iNFT ownership. Eternal Clans (the flagship consumer app) is built directly on top and delivers the addictive experience: players mint a full clan as one iNFT, co-create permanent UGC gaming realms via OpenClaw prompts, watch the clan autonomously evolve with zero context loss, and trade the entire living civilization with all history and intelligence intact.

## Why This Combined Version Is the Ultimate Product

The result is one elegant product with massive depth and consumer appeal: deepest OpenClaw + 0G stack integration, true ownership of living AI systems, instant permanent UGC worlds, and seamless mint → create → evolve → trade flow. It solves the core problems of context loss, lack of ownership, and siloed creation in one focused, tradable digital nation experience.

## Architecture

```text
0gclawforge/
  os-core/              Sovereign agent OS composition layer
  clans-app/            Eternal Clans application logic on top of the OS
  agents/               OpenClaw realm generation, proposals, voting, evolution
  storage/              Permanent 0G memory/log wrapper
  compute/              TEE-verifiable 0G inference wrapper
  packages/contracts/   ERC-7857 clan iNFT, marketplace, registry, oracle
  packages/sdk/         Typed 0G Storage, Compute, Memory, iNFT primitives
  packages/shared/      Product constants, network config, shared types
  apps/dashboard/       Five-screen Next.js MVP UI
  scripts/              Deploy and verification shell entry points
  demo/                 3-minute Loom script and recording checklist
```

The older dashboard routes remain available, but the primary MVP entry point is `/` with five tabs only: Forge OS, Mint Clan, UGC Realm Builder, Live Clan Dashboard, and Trade Clan.

## 0G Galileo Testnet Defaults

- Chain ID: `16602`
- Primary RPC: `https://evmrpc-testnet.0g.ai`
- Alternate RPCs: `https://rpc.ankr.com/0g_galileo_testnet_evm`, `https://0g-galileo-testnet.drpc.org`
- Explorer: `https://chainscan-galileo.0g.ai`
- Storage indexer: `https://indexer-storage-testnet-turbo.0g.ai`

All contracts, SDK calls, and wallet connections read from env-backed config.

## Quick Start

```bash
pnpm install
cp .env.example .env
pnpm test
pnpm dev
```

Open `http://localhost:3000` and run the focused flow:

1. Review Forge OS pillars.
2. Mint the clan iNFT.
3. Generate a UGC realm from a prompt.
4. Create and execute a community evolution proposal in the Live Clan Dashboard.
5. Review the Trade Clan transfer bundle.

## How to Run the Demo

```bash
pnpm demo
```

For a live Galileo deployment:

```bash
cp .env.example .env
# Fill PRIVATE_KEY and funded Galileo wallet values.
pnpm deploy:testnet
pnpm dev
```

## Easy Mainnet Swap (1-minute change)

1. Copy `.env.example` → `.env`.
2. Change `CHAIN_ID` / `VITE_CHAIN_ID` / `NEXT_PUBLIC_OG_CHAIN_ID` to `16661`.
3. Change `RPC_URL` / `VITE_RPC_URL` / `NEXT_PUBLIC_OG_RPC_URL` to `https://evmrpc.0g.ai`.
4. Change `EXPLORER_URL` / `VITE_EXPLORER_URL` / `NEXT_PUBLIC_OG_EXPLORER` to `https://chainscan.0g.ai`.
5. Update any contract addresses in `.env` after deployment.
6. Run `yarn deploy:mainnet` or `pnpm deploy:mainnet`.
7. Redeploy contracts and update iNFT references.

## Environment Variables

See [.env.example](.env.example). Key variables:

- `VITE_CHAIN_ID`, `VITE_RPC_URL`, `VITE_EXPLORER_URL`, `VITE_STORAGE_INDEXER`
- `NEXT_PUBLIC_OG_CHAIN_ID`, `NEXT_PUBLIC_OG_RPC_URL`, `NEXT_PUBLIC_OG_EXPLORER`
- `PRIVATE_KEY`
- `OG_STORAGE_INDEXER_TURBO`, `OG_COMPUTE_PROVIDER_ADDR`
- `NEXT_PUBLIC_AGENT_INFT_ADDRESS`, `NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS`

## Scripts

```bash
pnpm dev                # Start all dev tasks through Turbo
pnpm demo               # Build, then launch the dashboard demo
pnpm build              # Build all workspace packages
pnpm test               # Run focused tests
pnpm typecheck          # Type check all workspaces
pnpm deploy:testnet     # Deploy contracts to 0G Galileo Testnet
pnpm deploy:mainnet     # Deploy contracts to 0G Mainnet
pnpm verify:contracts   # Contract verification entry point
```

## Current Verification

- `pnpm --filter @0gclawforge/contracts test`
- `pnpm --filter @0gclawforge/dashboard typecheck`
- `pnpm --filter @0gclawforge/shared typecheck`
- `pnpm --filter @0gclawforge/sdk typecheck`
- `pnpm --filter @0gclawforge/storage typecheck`
- `pnpm --filter @0gclawforge/compute typecheck`
- `pnpm --filter @0gclawforge/agents typecheck`
- `pnpm --filter @0gclawforge/os-core typecheck`
- `pnpm --filter @0gclawforge/clans-app typecheck`

## License

MIT
