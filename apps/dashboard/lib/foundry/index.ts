/**
 * Dashboard-side Foundry helpers.
 *
 * The dashboard already talks to 0G via `@0gclawforge/sdk` and the local
 * `lib/0g-*.ts` re-exports. These helpers add:
 *
 *   - `foundryEnvFromBrowser()`: resolves a FoundryEnv from
 *     NEXT_PUBLIC_* vars + the connected wallet, so React components can
 *     hand a coherent config to the 0gkit-react hooks.
 *
 *   - `clanEventEnvelope()`: pure helper around ClanDA.envelope so the UI
 *     can preview the canonical encoding before publishing.
 *
 *   - `publishClanEventClient()`: client-side DA publish, used by the
 *     FoundryPanel component to anchor a quest/vote without server round-trip.
 */
import { ClanDA } from "@0gclawforge/foundry/da";
import {
  buildClanAttestation,
  canonicalClanEvent,
  clanEventDigest,
} from "@0gclawforge/foundry/attestation";
import { resolveFoundryEnv } from "@0gclawforge/foundry/env";
import type {
  ClanEventEnvelope,
  ClanEventKind,
  FoundryEnv,
} from "@0gclawforge/foundry/types";

export function foundryEnvFromBrowser(): FoundryEnv {
  const overrides: Partial<FoundryEnv> = {};
  if (typeof process !== "undefined" && process.env) {
    if (process.env.NEXT_PUBLIC_OG_RPC_URL) {
      overrides.rpcUrl = process.env.NEXT_PUBLIC_OG_RPC_URL;
    }
    if (process.env.NEXT_PUBLIC_STORAGE_INDEXER) {
      overrides.indexerUrl = process.env.NEXT_PUBLIC_STORAGE_INDEXER;
    }
    if (process.env.NEXT_PUBLIC_OG_CHAIN_ID) {
      overrides.chainId = Number.parseInt(process.env.NEXT_PUBLIC_OG_CHAIN_ID, 10);
    }
    if (process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS) {
      overrides.agentInftAddress = process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS;
    }
    if (process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS) {
      overrides.marketplaceAddress = process.env.NEXT_PUBLIC_AGENT_MARKETPLACE_ADDRESS;
    }
  }
  return resolveFoundryEnv(overrides);
}

export function clanEventEnvelope<P>(
  kind: ClanEventKind,
  tokenId: bigint | number | string,
  payload: P,
  storageRoot?: string,
): ClanEventEnvelope & { canonical: string; digest: `0x${string}` } {
  return new ClanDA().envelope(kind, tokenId, payload, storageRoot);
}

export async function publishClanEventClient(
  kind: ClanEventKind,
  tokenId: bigint | number | string,
  payload: unknown,
  options: { encoderUrl?: string; storageRoot?: string } = {},
) {
  const da = new ClanDA({ encoderUrl: options.encoderUrl });
  const envelope = da.envelope(kind, tokenId, payload, options.storageRoot);
  const result = await da.publish(envelope);
  return { envelope, ...result };
}

export { buildClanAttestation, canonicalClanEvent, clanEventDigest };
