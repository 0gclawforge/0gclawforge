#!/usr/bin/env -S node --experimental-strip-types
/**
 * Publish a clan vote tally to 0G DA and (optionally) call
 * AgentINFT.updateVoteRoot with the resulting digest as the on-chain proof.
 *
 * Usage:
 *   pnpm tsx scripts/foundry/publish-vote-tally.ts \
 *     --tokenId 1 --yes 12 --no 3 --proposalId p-7 [--update]
 */
import { argv, exit, stdout, stderr } from "node:process";
import { ClanDA, resolveFoundryEnv } from "@0gclawforge/foundry";
import { agentInftAbi } from "@0gclawforge/sdk";
import { ethers } from "ethers";

interface Args {
  tokenId?: string;
  yes?: number;
  no?: number;
  proposalId?: string;
  storageRoot?: string;
  update?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--update") {
      args.update = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value) continue;
    switch (flag) {
      case "--tokenId":
        args.tokenId = value;
        i++;
        break;
      case "--yes":
        args.yes = Number.parseInt(value, 10);
        i++;
        break;
      case "--no":
        args.no = Number.parseInt(value, 10);
        i++;
        break;
      case "--proposalId":
        args.proposalId = value;
        i++;
        break;
      case "--storageRoot":
        args.storageRoot = value;
        i++;
        break;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!args.tokenId) throw new Error("--tokenId required");
  if (typeof args.yes !== "number") throw new Error("--yes required");
  if (typeof args.no !== "number") throw new Error("--no required");

  const env = resolveFoundryEnv();
  const da = new ClanDA();
  const envelope = da.envelope(
    "clan.vote.tally",
    args.tokenId,
    { yes: args.yes, no: args.no, proposalId: args.proposalId ?? null },
    args.storageRoot,
  );
  const result = await da.publish(envelope);

  stdout.write(JSON.stringify({ envelope, result }, null, 2) + "\n");

  if (args.update) {
    if (!env.privateKey) throw new Error("PRIVATE_KEY required for --update");
    if (!env.agentInftAddress) throw new Error("NEXT_PUBLIC_AGENT_INFT_ADDRESS required for --update");
    const provider = new ethers.JsonRpcProvider(env.rpcUrl);
    const wallet = new ethers.Wallet(env.privateKey, provider);
    const contract = new ethers.Contract(
      env.agentInftAddress,
      agentInftAbi as unknown as ethers.InterfaceAbi,
      wallet,
    );
    // proof bytes = canonical envelope encoded as utf-8 + digest reference,
    // wrapped as bytes. AgentINFT only checks length, so any non-empty
    // sentinel works; we use the digest itself so it's verifiable off-chain.
    const proof = result.digest;
    const tx = await contract.updateVoteRoot(
      BigInt(args.tokenId),
      `og://${result.daRef ?? result.digest}`,
      BigInt(args.yes + args.no),
      proof,
    );
    const receipt = await tx.wait();
    stdout.write(`\nupdateVoteRoot tx: ${receipt?.hash}\n`);
  }
}

main().catch((err) => {
  stderr.write(`publish-vote-tally failed: ${err instanceof Error ? err.message : String(err)}\n`);
  exit(1);
});
