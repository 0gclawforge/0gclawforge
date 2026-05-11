# 0GClawForge -- The Sovereign Agent OS

```
   ___  ___  _____ _                ______
  / _ \/ _ \/  __ \ |               |  ___|
 | | | / /_\ \ /  \/ | __ ___      _| |_ ___  _ __ __ _  ___
 | | | |  _  | |   | |/ _` \ \ /\ / /  _/ _ \| '__/ _` |/ _ \
 \ \_/ / | | | \__/\ | (_| |\ V  V /| || (_) | | | (_| |  __/
  \___/\_| |_/\____/_|\__,_| \_/\_/ \_| \___/|_|  \__, |\___|
                                                    __/ |
                                                   |___/
```

**Mint, orchestrate, own, and evolve multi-agent swarms as ERC-7857 iNFTs on 0G.**

[Demo video: /docs/demo.mp4]

---

## Features

- :brain: **Persistent AI Memory** -- Agent memories stored forever on 0G Storage with cross-session recall
- :lobster: **OpenClaw Integration** -- 6 native skills with AGENTS.md auto-routing
- :lock: **ERC-7857 iNFT Ownership** -- Sovereign agent ownership with encrypted metadata
- :zap: **TEE-Verified Inference** -- All AI compute through 0G Compute with micropayment settlement
- :honeybee: **Multi-Agent Swarms** -- Supervisor/worker orchestration with parallel execution
- :chart_with_upwards_trend: **Agent Marketplace** -- Decentralized iNFT trading with secure transfer
- :arrows_counterclockwise: **Self-Improving Agents** -- Agents write learnings back to 0G Storage after every task

## Architecture

```
+-------------------------------------------------------------+
|                    0GClawForge OS                            |
|                                                              |
|  +-------------+   +-------------+   +-------------+        |
|  |  Dashboard   |   |   OpenClaw  |   |  0G Chain   |       |
|  |  (Next.js)   |<--|  (Skills)   |-->|  (EVM L1)   |       |
|  +------+-------+   +------+------+   +------+------+       |
|         |                  |                  |              |
|  +------v-------+   +-----v-------+   +------v------+       |
|  | 0G Storage   |   | 0G Compute  |   |  ERC-7857   |       |
|  | (Memory)     |   | (TEE AI)    |   |  (iNFT)     |       |
|  +--------------+   +-------------+   +-------------+       |
+-------------------------------------------------------------+
```

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/YOUR_ORG/0gclawforge
cd 0gclawforge
pnpm install

# 2. Set up environment
cp .env.example .env
# Fill in: PRIVATE_KEY (funded on Galileo testnet), ANTHROPIC_API_KEY

# 3. Get testnet tokens
# Visit https://faucet.0g.ai

# 4. Deploy contracts
pnpm deploy:testnet

# 5. Start dashboard
pnpm dev
# Open http://localhost:3000
```

## 0G Component Usage

| Component | Usage | SDK |
|-----------|-------|-----|
| 0G Storage | Agent intelligence + memory persistence | @0gfoundation/0g-ts-sdk |
| 0G Compute | TEE-verified AI inference for all agents | @0glabs/0g-serving-broker |
| 0G Chain | iNFT minting, registry, marketplace | ethers.js + Hardhat |
| ERC-7857 (iNFT) | Sovereign agent ownership + transfer | Custom AgentINFT.sol |
| 0G Memory | Cross-session recall engine | MemoryEngine (custom) |
| OpenClaw | Agent gateway + skill execution | 6 skill plugins |

## Project Structure

```
0gclawforge/
  apps/
    dashboard/          Next.js 14 App Router UI
    openclaw-fork/      OpenClaw fork with 6 0G skills
  packages/
    contracts/          Hardhat smart contracts (ERC-7857 + Marketplace + Registry)
    sdk/                Typed 0G Storage + Compute + Memory wrappers
    shared/             Shared types + constants
  docs/                 Architecture, demo script, submission
```

## Environment Variables

See [.env.example](.env.example) for the full list.

## Contract Addresses

After deploying with `pnpm deploy:testnet`, addresses are written to `packages/contracts/.env.deployed`.

### Testnet (Galileo, chainId 16602)
- AgentINFT: [deploy first]
- AgentRegistry: [deploy first]
- AgentMarketplace: [deploy first]
- MockOracle: [deploy first]

## Scripts

```bash
pnpm dev              # Start local dev server
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # Type check all packages
pnpm deploy:testnet   # Deploy contracts to 0G testnet
```

## License

MIT
