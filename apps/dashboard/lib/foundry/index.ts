/**
 * Dashboard-side Foundry helpers.
 *
 * The dashboard already talks to 0G via `@0gclawforge/sdk` and the local
 * `lib/0g-*.ts` re-exports. These helpers add:
 *
 *   - `foundryEnvFromBrowser()`: resolves a FoundryEnv for the chain selected
 *     by the connected wallet, so React components use the same endpoints as
 *     the rest of the dashboard.
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
import {
  getAgentInftAddress,
  getAgentMarketplaceAddress,
  getOgRpcUrl,
  getOgStorageIndexer,
} from "../contract-addresses";
import type {
  ClanEventEnvelope,
  ClanEventKind,
  FoundryEnv,
} from "@0gclawforge/foundry/types";

export function foundryEnvFromBrowser(chainId: number): FoundryEnv {
  return resolveFoundryEnv({
    network: chainId === 16661 ? "aristotle" : "galileo",
    chainId,
    rpcUrl: getOgRpcUrl(chainId),
    indexerUrl: getOgStorageIndexer(chainId),
    agentInftAddress: getAgentInftAddress(chainId),
    marketplaceAddress: getAgentMarketplaceAddress(chainId),
  });
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
  options: {
    network?: "aristotle" | "galileo";
    encoderUrl?: string;
    storageRoot?: string;
  } = {},
) {
  const da = new ClanDA({ network: options.network, encoderUrl: options.encoderUrl });
  const envelope = da.envelope(kind, tokenId, payload, options.storageRoot);
  const result = await da.publish(envelope);
  return { envelope, ...result };
}

export { buildClanAttestation, canonicalClanEvent, clanEventDigest };
