#!/usr/bin/env -S node --experimental-strip-types
/**
 * Read on-chain clan state via the AgentINFT ABI exported by
 * @0gclawforge/sdk, using a network resolved by the Foundry env helper.
 * Optionally downloads memory + vote blobs from 0G Storage.
 *
 * Usage:
 *   pnpm tsx scripts/foundry/inspect-clan.ts --tokenId 1 [--blobs]
 */
import { argv, exit, stderr, stdout } from "node:process";
import { FoundryStorage, resolveFoundryEnv } from "@0gclawforge/foundry";
import { agentInftAbi } from "@0gclawforge/sdk";
import { ethers } from "ethers";

interface Args {
  tokenId?: string;
  blobs?: boolean;
}

function parseArgs(): Args {
  const args: Args = {};
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === "--blobs") {
      args.blobs = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value) continue;
    if (flag === "--tokenId") {
      args.tokenId = value;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  if (!args.tokenId) throw new Error("--tokenId required");

  const env = resolveFoundryEnv();
  if (!env.agentInftAddress) throw new Error("NEXT_PUBLIC_AGENT_INFT_ADDRESS required");

  const provider = new ethers.JsonRpcProvider(env.rpcUrl);
  const contract = new ethers.Contract(
    env.agentInftAddress,
    agentInftAbi as unknown as ethers.InterfaceAbi,
    provider,
  );

  const tokenId = BigInt(args.tokenId);
  const [agentData, clanState] = await Promise.all([
    contract.getAgentData(tokenId),
    contract.getClanState(tokenId),
  ]);

  const summary = {
    network: env.network,
    chainId: env.chainId,
    tokenId: tokenId.toString(),
    agentName: agentData.agentName,
    modelType: agentData.modelType,
    isListedForSale: agentData.isListedForSale,
    salePrice: agentData.salePrice.toString(),
    memorySize: agentData.memorySize.toString(),
    skillCount: agentData.skillCount.toString(),
    taskCount: agentData.taskCount.toString(),
    clan: {
      memoryRootURI: clanState.memoryRootURI,
      realmRootURI: clanState.realmRootURI,
      voteRootURI: clanState.voteRootURI,
      realmCount: clanState.realmCount.toString(),
      proposalCount: clanState.proposalCount.toString(),
      evolutionCount: clanState.evolutionCount.toString(),
    },
  };

  stdout.write(JSON.stringify(summary, null, 2) + "\n");

  if (args.blobs) {
    const storage = new FoundryStorage({
      rpcUrl: env.rpcUrl,
      indexerUrl: env.indexerUrl,
    });
    for (const [label, uri] of [
      ["memory", clanState.memoryRootURI],
      ["realm", clanState.realmRootURI],
      ["votes", clanState.voteRootURI],
    ] as const) {
      if (!uri) continue;
      try {
        const json = await storage.downloadJSON(uri);
        stdout.write(`\n[${label}] ${uri}\n${JSON.stringify(json, null, 2)}\n`);
      } catch (err) {
        stderr.write(`\n[${label}] ${uri} — download failed: ${err instanceof Error ? err.message : err}\n`);
      }
    }
  }
}

main().catch((err) => {
  stderr.write(`inspect-clan failed: ${err instanceof Error ? err.message : String(err)}\n`);
  exit(1);
});
