# Foundry Protocol × 0GClawForge integration

This document describes the Foundry × 0GClawForge bridge that ships in this
PR and what it gives the project.

## TL;DR

Four net-new capabilities, all opt-in, all additive — nothing in the existing
SDK or app is changed.

| Capability                       | Before this PR                          | With this PR                                       |
| -------------------------------- | --------------------------------------- | -------------------------------------------------- |
| **0G Data Availability**         | Not used.                               | First-class. Anchor any clan event for ~free.      |
| **TEE attestation envelopes**    | Implicit in the broker call only.       | Signed `foundry/eval-result/v1` envelopes you can pass around and verify offline. |
| **React hooks for 0G**           | Hand-rolled `lib/0g-*.ts` calls.        | `useClanDA`, `useUpload`, `useDownload`, `useInference`, `useAttestation`. |
| **MCP server for agent runtimes**| None.                                   | `@0gclawforge/mcp` — every clan + 0G primitive as an MCP tool. |

## Architecture

```
                              ┌──────────────────────────────────────────────┐
   apps/dashboard ───────────►│ apps/dashboard/lib/foundry                   │
                              │   - foundryEnvFromBrowser()                  │
                              │   - useClanDA()                              │
                              │   - <FoundryPanel/>                          │
   apps/mcp ────────────────► │ apps/mcp/src/index.ts (MCP server)           │
                              │   tools: clan_*, zerog_*, foundry_env        │
   scripts/foundry/* ───────► │ anchor-quest, publish-vote-tally,            │
                              │   inspect-clan                               │
                              └──────────────────────────────────────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────────────────────┐
                              │ packages/foundry (@0gclawforge/foundry)      │
                              │   FoundryStorage · FoundryCompute            │
                              │   ClanDA · buildClanAttestation              │
                              │   anchorQuestOutcome · resolveFoundryEnv     │
                              └──────────────────────────────────────────────┘
                                              │
                                              ▼
                              ┌──────────────────────────────────────────────┐
                              │ @foundryprotocol/0gkit-{core,storage,        │
                              │   compute,da,attestation,chain,react}        │
                              │   (npm — Foundry Protocol's neutral 0G       │
                              │   toolkit, open source)                      │
                              └──────────────────────────────────────────────┘
```

The existing `@0gclawforge/sdk` is untouched. The bridge accepts the same
`StorageConfig` / `ComputeConfig` shapes so any call site can opt in by
switching its import.

## What lives where

### `packages/foundry/`

| File                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `src/types.ts`        | `ClanEventEnvelope`, `ClanEventKind`, `FoundryEnv`, config shapes.       |
| `src/env.ts`          | Resolve a `FoundryEnv` from `process.env` + overrides. Reads the same `NEXT_PUBLIC_*` vars the dashboard already uses. |
| `src/storage.ts`      | `FoundryStorage` — drop-in replacement for `@0gclawforge/sdk` storage built on `@foundryprotocol/0gkit-storage`. |
| `src/compute.ts`      | `FoundryCompute` — drop-in replacement for `ZGComputeClient`, on `@foundryprotocol/0gkit-compute`. |
| `src/da.ts`           | `ClanDA` — build/publish/verify canonical envelopes for clan events on 0G Data Availability. |
| `src/attestation.ts`  | `buildClanAttestation`, `signClanAttestation`, `verifyClanAttestation` — Foundry-shape envelopes anyone can verify. |
| `src/quest.ts`        | `anchorQuestOutcome` — one-call end-to-end (DA + attestation + optional on-chain recordTaskCompletion). |

### `apps/mcp/`

`@0gclawforge/mcp` — a stdio MCP server. Tools:

- `foundry_env` — show resolved network/chain/contracts.
- `clan_get_state(tokenId)` — read on-chain agent + clan state.
- `clan_list_owned(owner)` — enumerate tokenIds owned by an address.
- `clan_read_memory(rootHash)` — download + parse a memory blob.
- `clan_publish_event(kind, tokenId, payload, storageRoot?)` — anchor on DA.
- `clan_anchor_quest(...)` — DA + attestation + (optional) recordTaskCompletion.
- `clan_verify_attestation(signed, expectedSigner)` — verify a signed envelope.
- `zerog_storage_upload(data, encoding?)` — upload to 0G Storage.
- `zerog_storage_download(rootHash)` — download by root hash.
- `zerog_compute_query(userMessage, ...)` — run a verifiable inference.

Wire it up in Claude Code / Cursor / Cline via the snippet in
[`apps/mcp/README.md`](../../apps/mcp/README.md).

### `apps/dashboard/`

Additive only:

- `app/foundry/page.tsx` — opt-in route at `/foundry` that mounts the panel.
- `components/foundry/FoundryPanel.tsx` — pick an event kind, build a payload,
  preview the canonical digest, publish to 0G DA.
- `lib/foundry/index.ts` — `foundryEnvFromBrowser`, `clanEventEnvelope`,
  `publishClanEventClient`.
- `lib/foundry/use-clan-da.ts` — the `useClanDA` hook.

### `scripts/foundry/`

- `anchor-quest.ts` — end-to-end demo of the quest pipeline.
- `publish-vote-tally.ts` — publishes a vote to DA, optionally calls
  `updateVoteRoot` with the resulting digest as the on-chain `proof`.
- `inspect-clan.ts` — reads a clan's on-chain state and downloads blobs.

## Clan event envelope spec

```ts
type ClanEventKind =
  | "clan.quest.outcome"
  | "clan.vote.tally"
  | "clan.realm.snapshot"
  | "clan.evolution.record"
  | "clan.memory.delta";

interface ClanEventEnvelope {
  kind: ClanEventKind;
  tokenId: string;     // stringified to survive JSON without precision loss
  timestamp: number;   // unix millis
  payload: unknown;    // schema-by-kind
  storageRoot?: string;
}
```

All envelopes are canonicalized (sorted keys, no whitespace) before digesting.
Two structurally-equal payloads always yield the same `digest`, regardless of
how they were constructed in code — this is the property that lets the DA
digest serve as the on-chain anchor for `updateRealmRoot` / `updateVoteRoot`
proofs.

## Attestation envelope spec

`signClanAttestation` produces a `SignedEnvelope` whose inner shape is
Foundry's standard `foundry/eval-result/v1`:

```ts
interface AttestationEnvelope {
  kind: "foundry/eval-result/v1";
  forge: Address;            // AgentINFT contract, or per-clan forge
  scores: number[];          // derived from the clan event
  baseline: number;
  teeAttestation: Hex;       // broker attestation bytes
  daRef?: string;            // DA reference for the event
  coordinator: Address;      // signer
  timestamp: number;
}
```

The envelope is hashed via `keccak256(canonical-JSON)` and signed with the
operator's key (EIP-191 personal-sign). Verification recovers the signer and
returns `{ ok, checks: { digest, signer }, signer }` — it never throws on a
bad signature.

## Quickstart

### 1. Install + build the new packages

```bash
pnpm install
pnpm --filter @0gclawforge/foundry build
pnpm --filter @0gclawforge/mcp build
```

### 2. Anchor a quest

```bash
PRIVATE_KEY=0x... \
NEXT_PUBLIC_AGENT_INFT_ADDRESS=0x0FB5eBd1821d644E1faba9608255E30b3c44a6ba \
NEXT_PUBLIC_OG_RPC_URL=https://evmrpc-testnet.0g.ai \
NEXT_PUBLIC_OG_CHAIN_ID=16602 \
pnpm tsx scripts/foundry/anchor-quest.ts \
  --tokenId 1 --prompt "raid the cave" --outcome "won" --success true
```

### 3. Plug the MCP server into Claude Code

```jsonc
// ~/.config/claude/mcp.json
{
  "mcpServers": {
    "0gclawforge": {
      "command": "node",
      "args": ["/abs/path/0gclawforge/apps/mcp/dist/index.js"],
      "env": { "PRIVATE_KEY": "0x...", "NEXT_PUBLIC_OG_RPC_URL": "https://evmrpc-testnet.0g.ai" }
    }
  }
}
```

Then ask Claude things like:

- "Read clan tokenId 3's state and tell me how many evolutions it has."
- "Publish this vote tally to 0G DA: tokenId 3, yes 8, no 1, proposal p-12."
- "Anchor a quest outcome for tokenId 3: success=true, outcome=...."

### 4. Open `/foundry` in the dashboard

`pnpm --filter @0gclawforge/dashboard dev`, then go to `/foundry` and try
the panel. It builds canonical envelopes, previews the digest, and publishes
to DA — no server round-trip.

## Migration path (optional)

You don't have to migrate anything to benefit from this PR. But if you want
to consolidate on the Foundry stack later, the swap is mechanical:

- `import { uploadJSON } from "@0gclawforge/sdk"` →
  `const storage = new FoundryStorage(cfg); await storage.uploadJSON(value)`
- `import { ZGComputeClient } from "@0gclawforge/sdk"` →
  `new FoundryCompute(cfg)`. The `query(message, opts)` surface matches.

## What this does **not** change

- The existing `@0gclawforge/sdk` package — every export still works.
- The dashboard's existing tabs (Forge / Memory / Marketplace / Swarm / Play / Docs).
- The Telegram / Discord bots in `agents/`.
- The contract addresses, RPC URLs, or any deploy story.

## Where to go next

See the [examples folder](../../examples/foundry/) for runnable recipes.
