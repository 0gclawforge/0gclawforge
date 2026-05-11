# 0GClawForge Architecture

```
+-------------------------------------------------------------+
|                    0GClawForge OS                            |
|                                                              |
|  +-------------+   +-------------+   +-------------+        |
|  |  ClawForge  |   |   OpenClaw  |   |  0G Chain   |        |
|  |  Dashboard  |<--|   Gateway   |-->|  (EVM L1)   |        |
|  |  (Next.js)  |   |  (Skills)   |   |             |        |
|  +------+------+   +------+------+   +------+------+        |
|         |                 |                  |               |
|         v                 v                  v               |
|  +-------------+   +-------------+   +-------------+        |
|  | 0G Storage  |   | 0G Compute  |   |  ERC-7857   |        |
|  | (Memory +   |   | (TEE AI     |   | iNFT Contr. |        |
|  |  Intel.)    |   |  Inference) |   |             |        |
|  +-------------+   +-------------+   +-------------+        |
|                                                              |
|  Agent Lifecycle:                                            |
|  Forge -> Mint iNFT -> Store Intel. -> Run Tasks ->          |
|  Write Memory -> Improve -> Trade                            |
+-------------------------------------------------------------+
```

## Data Flow

1. **Forge**: User creates agent config -> encrypted -> uploaded to 0G Storage -> iNFT minted on 0G Chain
2. **Execute**: Task submitted -> supervisor decomposes via 0G Compute -> workers execute in parallel -> results synthesized
3. **Learn**: Task outcome -> memory entry created -> uploaded to 0G Storage -> iNFT metadata updated on-chain
4. **Trade**: Seller lists on marketplace -> buyer pays -> oracle re-encrypts intelligence in TEE -> secure transfer on-chain

## Key Contracts

- **AgentINFT (ERC-7857)**: Sovereign agent ownership with encrypted metadata
- **AgentRegistry**: On-chain capability registry + swarm membership
- **AgentMarketplace**: Trustless trading with 2.5% platform fee
- **MockOracle**: Testnet proof verifier (accepts all proofs)

## SDK Layers

- `packages/sdk/storage.ts`: 0G Storage upload/download via @0gfoundation/0g-ts-sdk
- `packages/sdk/compute.ts`: 0G Compute inference via @0glabs/0g-serving-broker
- `packages/sdk/memory.ts`: Persistent memory engine with keyword search + pruning
- `packages/sdk/inft.ts`: iNFT contract interaction helpers
