import {
  digestEnvelope,
  parseEnvelope,
  recoverSigner,
  reportEnvelope,
  signEnvelope,
  verifyEnvelope,
  type AttestationEnvelope,
  type SignedEnvelope,
  type VerifyResult,
} from "@foundryprotocol/0gkit-attestation";
import type { Address, Hex } from "viem";
import type { ClanEventEnvelope } from "./types.js";
import { canonicalJsonStringify, digestJson } from "@foundryprotocol/0gkit-core";

export type {
  AttestationEnvelope,
  SignedEnvelope,
  VerifyResult,
} from "@foundryprotocol/0gkit-attestation";

/**
 * Inputs needed to wrap a clan event in a Foundry-shaped, signable
 * attestation envelope. The `forge` address can be the AgentINFT contract
 * (treating each clan as a forge) or any project-controlled identifier.
 */
export interface BuildClanAttestationParams {
  /** AgentINFT contract or per-clan forge address. */
  forge: Address;
  /** Operator/coordinator address — the publisher of the attestation. */
  coordinator: Address;
  /** TEE attestation bytes (raw broker payload). */
  teeAttestation: Hex;
  /** Underlying clan event being attested. */
  event: ClanEventEnvelope;
  /** Numeric "scores" derived from the event — flexible per kind. */
  scores?: number[];
  /** Baseline score for comparison; defaults to 0. */
  baseline?: number;
  /** Optional reference into 0G DA (the result of ClanDA.publish). */
  daRef?: string;
}

/**
 * Build a Foundry-shape attestation envelope from a clan event. The envelope
 * is `foundry/eval-result/v1` so it slots into the same verification
 * pipelines used elsewhere in the Foundry ecosystem.
 */
export function buildClanAttestation(params: BuildClanAttestationParams): AttestationEnvelope {
  return {
    kind: "foundry/eval-result/v1",
    forge: params.forge,
    scores: params.scores ?? [eventScore(params.event)],
    baseline: params.baseline ?? 0,
    teeAttestation: params.teeAttestation,
    daRef: params.daRef,
    coordinator: params.coordinator,
    timestamp: params.event.timestamp,
  };
}

/** Sign a clan-event attestation. Returns the standard Foundry SignedEnvelope. */
export async function signClanAttestation(
  envelope: AttestationEnvelope,
  privateKey: Hex | string,
): Promise<SignedEnvelope> {
  return signEnvelope(envelope, privateKey);
}

/** Verify a signed clan attestation. Never throws — bad sigs yield ok:false. */
export async function verifyClanAttestation(
  signed: SignedEnvelope,
  expectedSigner: Address | string,
): Promise<VerifyResult> {
  return verifyEnvelope(signed, expectedSigner);
}

/** Human-readable multi-line summary for CLIs / logs. */
export function reportClanAttestation(signed: SignedEnvelope): string {
  return reportEnvelope(signed);
}

/**
 * Re-digest a clan event with the same canonicalization rules the DA layer
 * uses. Exported so callers can sanity-check that the digest carried in an
 * attestation matches the on-chain anchor.
 */
export function clanEventDigest(event: ClanEventEnvelope): Hex {
  return digestJson(event);
}

/** Canonicalize a clan event (sorted keys, no whitespace). */
export function canonicalClanEvent(event: ClanEventEnvelope): string {
  return canonicalJsonStringify(event);
}

export { digestEnvelope, parseEnvelope, recoverSigner };

/**
 * Derive a single numeric score from a clan event so the attestation
 * envelope has something meaningful in `scores[]`. The mapping is
 * intentionally lossy — callers that care about the full payload should
 * pin `daRef` and reconstruct from DA.
 */
function eventScore(event: ClanEventEnvelope): number {
  if (event.kind === "clan.vote.tally" && isVotePayload(event.payload)) {
    const total = event.payload.yes + event.payload.no;
    return total === 0 ? 0 : event.payload.yes / total;
  }
  if (event.kind === "clan.quest.outcome" && isQuestPayload(event.payload)) {
    return event.payload.success ? 1 : 0;
  }
  return 0;
}

function isVotePayload(p: unknown): p is { yes: number; no: number } {
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as { yes?: unknown }).yes === "number" &&
    typeof (p as { no?: unknown }).no === "number"
  );
}

function isQuestPayload(p: unknown): p is { success: boolean } {
  return typeof p === "object" && p !== null && typeof (p as { success?: unknown }).success === "boolean";
}
