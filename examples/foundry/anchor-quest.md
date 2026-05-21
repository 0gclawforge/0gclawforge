# Foundry × 0GClawForge: anchor a quest outcome

```bash
PRIVATE_KEY=0x... \
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai \
NEXT_PUBLIC_OG_CHAIN_ID=16602 \
NEXT_PUBLIC_AGENT_INFT_ADDRESS=0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba \
pnpm tsx scripts/foundry/anchor-quest.ts \
  --tokenId 1 \
  --prompt "raid the cave" \
  --outcome "won, +30g" \
  --success true
```

Output (shape):

```json
{
  "envelope": {
    "kind": "clan.quest.outcome",
    "tokenId": "1",
    "timestamp": 1717340000000,
    "payload": { "prompt": "raid the cave", "outcome": "won, +30g", "success": true }
  },
  "da": {
    "digest": "0x...",
    "daRef": "blob://...",
    "mode": "live",
    "latencyMs": 41
  },
  "attestation": {
    "envelope": { "kind": "foundry/eval-result/v1", "...": "..." },
    "digest": "0x...",
    "signature": "0x..."
  }
}
```

Pass `--record` to also call `AgentINFT.recordTaskCompletion(tokenId)` on
success. The script verifies the attestation locally before exiting.

## Why this matters

- **DA is cheaper than Storage.** Quest outcomes don't need permanent
  storage; a 32-byte digest + DA reference is enough to prove what
  happened.
- **Signed attestations are portable.** Anyone with the signed envelope
  can verify it with `verifyClanAttestation` — no chain access required.
- **One pipeline for every clan event.** The same envelope shape is used
  for quests, votes, realm snapshots, evolutions, and memory deltas, so
  off-chain consumers (indexers, analytics, judges) only need one parser.
