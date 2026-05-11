# 0GClawForge -- AI Agent Context

## What This Is
0GClawForge is a sovereign agent OS combining OpenClaw + 0G ecosystem.
Track 1 hackathon submission (0G OpenClaw Lab).

## Critical Rules for This Codebase
1. ALL storage uses @0gfoundation/0g-ts-sdk with Indexer class
2. ALL compute uses @0glabs/0g-serving-broker with createZGComputeNetworkBroker
3. Smart contracts deploy to 0G Chain (chainId: 16602 testnet, 16661 mainnet)
4. NEVER expose PRIVATE_KEY in client-side code
5. The iNFT contract is ERC-7857 (ERC-721 + encrypted metadata)
6. All agent intelligence blobs must be encrypted before storing on 0G Storage

## Key File Locations
- SDK wrappers: packages/sdk/src/
- Contracts: packages/contracts/contracts/
- Dashboard: apps/dashboard/
- OpenClaw skills: apps/openclaw-fork/skills/

## 0G Testnet Endpoints (Galileo)
- RPC: https://evmrpc-testnet.0g.ai
- Storage Indexer (Turbo): https://indexer-storage-testnet-turbo.0g.ai
- Faucet: https://faucet.0g.ai
- Explorer: https://chainscan-galileo.0g.ai
- Chain ID: 16602

## Mainnet Endpoints
- RPC: https://evmrpc.0g.ai
- Storage Indexer (Turbo): https://indexer-storage-turbo.0g.ai
- Chain ID: 16661

## Contract Addresses (Testnet)
See .env.deployed after running: pnpm deploy:testnet

## Common Patterns
See packages/sdk/src/ for typed wrappers around all 0G SDKs.
Do NOT call 0G SDKs directly -- always use the wrappers in packages/sdk/.
