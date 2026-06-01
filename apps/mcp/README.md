# `@0gclawforge/mcp`

A Model Context Protocol server that exposes 0GClawForge clans (mint, evolve,
propose, query state/memory) and the neutral 0G primitives (storage, compute,
DA, attestation) as tools any MCP-compatible agent runtime can call — Claude
Code, Cursor, Cline, Windsurf, custom agents.

It is built on top of `@0gclawforge/foundry`, which itself wraps
`@foundryprotocol/0gkit-*` (the open-source Foundry Protocol toolkit).

## Why

The existing `@0gclawforge/sdk` is great for app code, but agents talk MCP.
This package gives an AI agent a one-line install path to *act on a clan*:
read state, upload memory, run inference, anchor a quest to 0G DA, sign /
verify a TEE attestation, all without bespoke wiring.

## Tools

| Tool                         | What it does                                                                |
| ---------------------------- | --------------------------------------------------------------------------- |
| `foundry_env`                | Inspect the resolved network, chain id, endpoints, and contract addresses. |
| `clan_get_state`             | Read on-chain `getAgentData` + `getClanState` for a tokenId.               |
| `clan_list_owned`            | Enumerate AgentINFT tokenIds owned by an address.                          |
| `clan_read_memory`           | Download a clan memory blob from 0G Storage and parse it.                  |
| `clan_publish_event`         | Anchor a clan event envelope on 0G DA. Returns the digest + DA reference.  |
| `clan_anchor_quest`          | End-to-end: build event → publish DA → sign attestation → record on-chain. |
| `clan_verify_attestation`    | Verify a signed Foundry attestation envelope.                              |
| `zerog_storage_upload`       | Upload bytes (utf-8 or base64) to 0G Storage.                              |
| `zerog_storage_download`     | Download bytes by 0G Storage root hash.                                    |
| `zerog_compute_query`        | Run inference through a 0G Compute provider.                               |

## Install

```bash
pnpm --filter @0gclawforge/mcp build
```

## Run

```bash
PRIVATE_KEY=0x... \
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai \
NEXT_PUBLIC_OG_CHAIN_ID=16602 \
NEXT_PUBLIC_AGENT_INFT_ADDRESS=0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba \
node apps/mcp/dist/index.js
```

## Wire to Claude Code

`~/.config/claude/mcp.json` (or per-project `.mcp.json`):

```json
{
  "mcpServers": {
    "0gclawforge": {
      "command": "node",
      "args": ["/abs/path/0gclawforge/apps/mcp/dist/index.js"],
      "env": {
        "PRIVATE_KEY": "0x...",
        "NEXT_PUBLIC_OG_RPC_URL": "https://evmrpc-testnet.0g.ai",
        "NEXT_PUBLIC_OG_CHAIN_ID": "16602",
        "NEXT_PUBLIC_AGENT_INFT_ADDRESS": "0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba"
      }
    }
  }
}
```

## Wire to Cursor / Cline

Both clients read the same MCP server schema. Point them at the built
`dist/index.js` and pass the same env vars.
