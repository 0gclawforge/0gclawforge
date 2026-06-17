#!/usr/bin/env -S node --experimental-strip-types
/**
 * End-to-end Foundry × 0GClawForge anchor demo.
 *
 *   1. Build a clan event envelope for a quest outcome.
 *   2. Compute the canonical digest (the on-chain anchor).
 *   3. Publish the envelope to 0G DA (falls back to local-digest if no
 *      encoder URL is configured).
 *   4. Sign a Foundry-shape attestation envelope (foundry/eval-result/v1).
 *   5. Verify the signed envelope locally.
 *   6. (Optional, with --record) call AgentINFT.recordTaskCompletion.
 *
 * Usage:
 *   pnpm tsx scripts/foundry/anchor-quest.ts --tokenId 1 \
 *     --prompt "raid the cave" --outcome "won" --success true [--record]
 *
 * Required env:
 *   PRIVATE_KEY                  (for attestation sig + on-chain call)
 *   NEXT_PUBLIC_AGENT_INFT_ADDRESS (required for --record)
 *   NEXT_PUBLIC_OG_RPC_URL       (defaults to galileo testnet RPC)
 *   OG_DA_ENCODER_URL            (optional; without it, mode="local")
 */
import { argv, exit, stderr, stdout } from "node:process";
import {
  anchorQuestOutcome,
  reportClanAttestation,
  resolveFoundryEnv,
  verifyClanAttestation,
} from "@0gclawforge/foundry";
import { ethers } from "ethers";

interface Args {
  tokenId?: string;
  prompt?: string;
  outcome?: string;
  success?: boolean;
  record?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--record") {
      args.record = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value) continue;
    switch (flag) {
      case "--tokenId":
        args.tokenId = value;
        i++;
        break;
      case "--prompt":
        args.prompt = value;
        i++;
        break;
      case "--outcome":
        args.outcome = value;
        i++;
        break;
      case "--success":
        args.success = value !== "false";
        i++;
        break;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!args.tokenId) throw new Error("--tokenId is required");
  if (!args.prompt) throw new Error("--prompt is required");
  if (!args.outcome) throw new Error("--outcome is required");

  const env = resolveFoundryEnv();
  if (!env.privateKey) {
    throw new Error("PRIVATE_KEY env var is required");
  }
  const signerAddress = new ethers.Wallet(env.privateKey).address as `0x${string}`;

  const result = await anchorQuestOutcome(
    args.tokenId,
    {
      prompt: args.prompt,
      outcome: args.outcome,
      success: args.success ?? true,
    },
    {
      teeAttestation: "0xdeadbeef", // replace with broker-returned bytes in prod
      signerKey: env.privateKey,
      signerAddress,
      recordOnChain: args.record === true,
    },
  );

  stdout.write(JSON.stringify(
    {
      envelope: result.envelope,
      da: result.da,
      attestation: result.attestation,
      recordedTx: result.recordedTx,
    },
    null,
    2,
  ) + "\n");

  if (result.attestation) {
    const verify = await verifyClanAttestation(result.attestation, signerAddress);
    stdout.write(`\nVerify: ${JSON.stringify(verify)}\n`);
    stdout.write(`\n${reportClanAttestation(result.attestation)}\n`);
  }
}

main().catch((err) => {
  stderr.write(`anchor-quest failed: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  exit(1);
});
