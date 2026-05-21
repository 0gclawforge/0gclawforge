import { ethers } from "ethers";
import { agentInftAbi } from "@0gclawforge/sdk";
import type { Address, Hex } from "viem";
import { ClanDA } from "./da";
import {
  buildClanAttestation,
  signClanAttestation,
  type SignedEnvelope,
} from "./attestation";
import type { ClanDigestPublishResult, ClanEventEnvelope } from "./types";
import { resolveFoundryEnv } from "./env";

export interface QuestOutcomePayload {
  prompt: string;
  outcome: string;
  success: boolean;
  /** Optional model identifier used for the inference. */
  model?: string;
  /** Optional reference to the broker attestation bytes returned alongside. */
  teeAttestationRef?: string;
  /** DePIN / RAG inputs that influenced the outcome. */
  depin?: Record<string, unknown>;
}

export interface AnchorQuestOptions {
  /** Sign the envelope with this key. Defaults to env.privateKey. */
  signerKey?: Hex | string;
  /** Address to verify the signature against. Required when signerKey is omitted. */
  signerAddress?: Address;
  /** TEE attestation bytes returned by the broker. Required for attestation. */
  teeAttestation?: Hex;
  /** Custom forge address for the attestation envelope. Defaults to the AgentINFT. */
  forge?: Address;
  /** Custom coordinator address. Defaults to the recovered signer. */
  coordinator?: Address;
  /** If true, also call AgentINFT.recordTaskCompletion on success. */
  recordOnChain?: boolean;
  /** Optional override of the 0G DA encoder URL. */
  daEncoderUrl?: string;
}

export interface AnchorQuestResult {
  envelope: ClanEventEnvelope;
  da: ClanDigestPublishResult;
  attestation?: SignedEnvelope;
  /** Tx hash of the on-chain recordTaskCompletion call, when requested. */
  recordedTx?: string;
}

/**
 * End-to-end anchor of a quest outcome:
 *
 *   1. Wrap the outcome in a canonical clan event
 *   2. Publish the envelope's digest to 0G DA
 *   3. (Optional) Sign a Foundry-shape attestation envelope with the TEE
 *      attestation bytes returned by the broker
 *   4. (Optional) Call AgentINFT.recordTaskCompletion on the iNFT
 *
 * This is the canonical "publish what just happened" entry point —
 * callers in agents/, os-core/, and the dashboard share this.
 */
export async function anchorQuestOutcome(
  tokenId: bigint | number | string,
  payload: QuestOutcomePayload,
  options: AnchorQuestOptions = {},
): Promise<AnchorQuestResult> {
  const env = resolveFoundryEnv({ daEncoderUrl: options.daEncoderUrl });
  const da = new ClanDA({ encoderUrl: env.daEncoderUrl, apiKey: env.daApiKey });

  const built = da.envelope("clan.quest.outcome", tokenId, payload);
  const event: ClanEventEnvelope = {
    kind: built.kind,
    tokenId: built.tokenId,
    timestamp: built.timestamp,
    payload: built.payload,
    storageRoot: built.storageRoot,
  };
  const daResult = await da.publish(event);

  let attestation: SignedEnvelope | undefined;
  if (options.teeAttestation && options.signerKey) {
    const forge =
      options.forge ?? (env.agentInftAddress as Address | undefined);
    if (!forge) {
      throw new Error(
        "anchorQuestOutcome requires options.forge or NEXT_PUBLIC_AGENT_INFT_ADDRESS in the environment",
      );
    }
    const wallet = new ethers.Wallet(String(options.signerKey));
    const coordinator =
      options.coordinator ?? (wallet.address as Address);
    const attestationEnv = buildClanAttestation({
      forge,
      coordinator,
      teeAttestation: options.teeAttestation,
      event,
      scores: [payload.success ? 1 : 0],
      daRef: daResult.daRef,
    });
    attestation = await signClanAttestation(attestationEnv, options.signerKey);
  }

  let recordedTx: string | undefined;
  if (options.recordOnChain && payload.success && env.agentInftAddress && env.privateKey) {
    const provider = new ethers.JsonRpcProvider(env.rpcUrl);
    const wallet = new ethers.Wallet(env.privateKey, provider);
    const contract = new ethers.Contract(
      env.agentInftAddress,
      agentInftAbi as unknown as ethers.InterfaceAbi,
      wallet,
    );
    // recordTaskCompletion is on the AgentINFT ABI exported by @0gclawforge/sdk.
    if (typeof (contract as ethers.Contract & { recordTaskCompletion?: unknown }).recordTaskCompletion === "function") {
      const tx = await (contract as ethers.Contract & {
        recordTaskCompletion: (id: bigint) => Promise<ethers.ContractTransactionResponse>;
      }).recordTaskCompletion(BigInt(tokenId));
      const receipt = await tx.wait();
      recordedTx = receipt?.hash;
    }
  }

  return { envelope: event, da: daResult, attestation, recordedTx };
}
