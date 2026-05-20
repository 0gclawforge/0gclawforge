import { DA } from "@foundryprotocol/0gkit-da";
import { canonicalJsonStringify, digestJson } from "@foundryprotocol/0gkit-core";
import type { Hex } from "viem";
import type {
  ClanDigestPublishResult,
  ClanEventEnvelope,
  ClanEventKind,
} from "./types.js";
import { resolveFoundryEnv } from "./env.js";

export interface ClanDAConfig {
  /** Network preset name. Defaults to galileo unless OG_CHAIN_ID = 16661. */
  network?: "aristotle" | "galileo";
  /** Optional override of the DA encoder URL. */
  encoderUrl?: string;
  /** Optional API key for the encoder. */
  apiKey?: string;
}

/**
 * Anchor clan events on 0G Data Availability. The DA layer is dramatically
 * cheaper than full storage uploads for high-cardinality records like quest
 * outcomes, vote tallies, and realm snapshots — and the keccak digest is
 * exactly what AgentINFT's `proof` byte-blobs are expected to anchor.
 *
 * Each envelope is canonicalized (sorted keys, no whitespace) before
 * digesting, so two structurally-equal payloads always yield the same
 * digest regardless of how they were constructed.
 */
export class ClanDA {
  private readonly inner: DA;

  constructor(config: ClanDAConfig = {}) {
    const env = resolveFoundryEnv({
      network: config.network,
      daEncoderUrl: config.encoderUrl,
      daApiKey: config.apiKey,
    });
    this.inner = new DA({
      network: env.network,
      encoderUrl: env.daEncoderUrl,
      apiKey: env.daApiKey,
    });
  }

  /**
   * Build a canonical envelope for a clan event. Use this when you need the
   * envelope *and* its digest (e.g. before signing an attestation).
   */
  envelope<Payload>(
    kind: ClanEventKind,
    tokenId: bigint | number | string,
    payload: Payload,
    storageRoot?: string,
  ): ClanEventEnvelope & { canonical: string; digest: Hex } {
    const env: ClanEventEnvelope = {
      kind,
      tokenId: String(tokenId),
      timestamp: Date.now(),
      payload,
      ...(storageRoot ? { storageRoot } : {}),
    };
    return {
      ...env,
      canonical: canonicalJsonStringify(env),
      digest: digestJson(env),
    };
  }

  /** keccak256 of the canonical-JSON encoding — matches the on-chain anchor. */
  digest(envelope: ClanEventEnvelope): Hex {
    return digestJson(envelope);
  }

  /**
   * Publish an envelope to 0G DA. Falls back to a local-only digest if no
   * encoder URL is configured — callers can still use the returned digest
   * as a `proof` payload for AgentINFT update calls.
   */
  async publish(envelope: ClanEventEnvelope): Promise<ClanDigestPublishResult> {
    const result = await this.inner.publish(envelope);
    return {
      digest: result.digest,
      daRef: result.daRef,
      blobId: result.blobId,
      mode: result.mode,
      latencyMs: result.latencyMs,
    };
  }

  /** Verify a payload matches an expected digest. Pure, no network. */
  verify(envelope: ClanEventEnvelope, expectedDigest: string): boolean {
    return this.inner.verify(envelope, expectedDigest);
  }
}
