import { ZGComputeClient } from "@0gclawforge/sdk";
import type { ComputeConfig, ComputeQueryOptions } from "@0gclawforge/sdk";
import {
  buildClanAttestation,
  signClanAttestation,
  type SignedEnvelope,
  type ClanEventEnvelope,
} from "@0gclawforge/foundry";
import { ethers } from "ethers";
import type { Address, Hex } from "viem";

/**
 * Result returned by every VerifiableInference call. Replaces the original
 * `{ mode: "0g-tee", issuedAt: now }` stub with a real signed Foundry
 * envelope when the caller provides a forge address.
 *
 * - `verified`: provider-reported verification status from the broker.
 * - `attestation`: high-level summary the dashboard / agents already use.
 * - `signedEnvelope`: present when `attestationKey` is configured; can be
 *   handed to anyone with `verifyClanAttestation` to verify offline.
 */
export interface VerifiableInferenceResult {
  readonly text: string;
  readonly verified: boolean;
  readonly providerAddress: string;
  readonly attestation: {
    readonly mode: "0g-tee" | "0g-tee+foundry";
    readonly issuedAt: number;
    readonly providerAddress: string;
    readonly verified: boolean;
  };
  readonly signedEnvelope?: SignedEnvelope;
}

export interface VerifiableInferenceOptions {
  /**
   * Address used as the `forge` field of the signed envelope. Typically
   * the AgentINFT contract (or a per-clan forge). When omitted, no
   * Foundry envelope is produced — `signedEnvelope` is undefined.
   */
  forge?: Address;
  /**
   * Address used as `coordinator`. Defaults to the address derived from
   * `attestationKey` (or from `ComputeConfig.privateKey`).
   */
  coordinator?: Address;
  /**
   * Private key used to sign the envelope. Defaults to the compute key.
   * Pass an explicit key to separate attestation identity from broker key.
   */
  attestationKey?: Hex | string;
  /**
   * Logical clan event the inference is attesting. Used to derive a
   * canonical digest that goes into the envelope. Defaults to a
   * "clan.memory.delta" wrap of `{ prompt }`.
   */
  event?: ClanEventEnvelope;
}

/**
 * A typed guardrail around 0G Compute. Every agent-facing call now
 * optionally returns a real signed Foundry attestation envelope alongside
 * the inference text.
 */
export class VerifiableInference {
  private readonly client: ZGComputeClient;
  private readonly config: ComputeConfig;

  constructor(config: ComputeConfig) {
    this.config = config;
    this.client = new ZGComputeClient(config);
  }

  async ensureProviderReady(fundAmountOG = 1): Promise<void> {
    await this.client.setupProvider(this.config.providerAddress, fundAmountOG);
  }

  async run(
    prompt: string,
    options: ComputeQueryOptions & VerifiableInferenceOptions = {},
  ): Promise<VerifiableInferenceResult> {
    const { forge, coordinator, attestationKey, event, ...queryOptions } = options;
    const result = await this.client.query(prompt, queryOptions);

    let signedEnvelope: SignedEnvelope | undefined;
    if (forge && (attestationKey || this.config.privateKey)) {
      const key = (attestationKey ?? this.config.privateKey) as string;
      const signerAddress = (coordinator ?? (new ethers.Wallet(key).address as Address)) as Address;
      const clanEvent: ClanEventEnvelope =
        event ?? {
          kind: "clan.memory.delta",
          tokenId: "0",
          timestamp: Date.now(),
          payload: { prompt, output: result.text },
        };
      const envelope = buildClanAttestation({
        forge,
        coordinator: signerAddress,
        teeAttestation: "0x", // broker doesn't currently surface bytes
        event: clanEvent,
        scores: [result.verified ? 1 : 0],
      });
      signedEnvelope = await signClanAttestation(envelope, key);
    }

    return {
      text: result.text,
      verified: result.verified,
      providerAddress: result.providerAddress,
      attestation: {
        mode: signedEnvelope ? "0g-tee+foundry" : "0g-tee",
        issuedAt: Date.now(),
        providerAddress: result.providerAddress,
        verified: result.verified,
      },
      signedEnvelope,
    };
  }

  async evolveClan(
    clanName: string,
    proposal: string,
    memoryContext: string,
  ): Promise<VerifiableInferenceResult> {
    return this.run(
      `Evolve the Eternal Clans civilization named "${clanName}" from this approved community proposal: ${proposal}\n\nPermanent memory context:\n${memoryContext}`,
      {
        systemPrompt:
          "You are an OpenClaw clan evolution swarm running through verified 0G TEE inference. Return concise JSON-friendly world updates.",
        temperature: 0.35,
        maxTokens: 900,
      },
    );
  }
}
