import { ethers } from "ethers";
import { agentInftAbi } from "@0gclawforge/sdk";
import type { AgentPassport, AgentPassportProof } from "@0gclawforge/sdk";
import { getAgentInftAddress, getOgRpcUrl } from "./contract-addresses";
import { getDungeonLeaderboard } from "./dungeon-leaderboard";

function normalizeClanState(raw: any) {
  return {
    memoryRoot: String(raw.memoryRootURI ?? raw[0] ?? ""),
    realmRoot: String(raw.realmRootURI ?? raw[1] ?? ""),
    voteRoot: String(raw.voteRootURI ?? raw[2] ?? ""),
    realmCount: Number(raw.realmCount ?? raw[3] ?? 0),
    proposalCount: Number(raw.proposalCount ?? raw[4] ?? 0),
    evolutionCount: Number(raw.evolutionCount ?? raw[5] ?? 0),
  };
}

function addProof(
  proofs: AgentPassportProof[],
  type: AgentPassportProof["type"],
  value: string,
  source: AgentPassportProof["source"]
) {
  if (value) proofs.push({ type, value, source, verified: true });
}

function reputationScore(input: {
  lifetimeXp: number;
  verifiedClears: number;
  bossKills: number;
  evolutionCount: number;
  realmCount: number;
}) {
  return Math.min(
    100,
    Math.floor(input.lifetimeXp / 50) +
      input.verifiedClears * 12 +
      input.bossKills * 8 +
      Math.min(10, input.evolutionCount * 2) +
      Math.min(10, input.realmCount * 2)
  );
}

export async function getAgentPassport(tokenId: string, chainId: number): Promise<AgentPassport> {
  if (!/^\d+$/.test(tokenId)) {
    throw new Error("tokenId must be a positive integer string");
  }

  const normalizedChainId = chainId === 16661 ? 16661 : 16602;
  const contractAddress = getAgentInftAddress(normalizedChainId);
  const provider = new ethers.JsonRpcProvider(getOgRpcUrl(normalizedChainId));
  const contract = new ethers.Contract(contractAddress, agentInftAbi, provider);
  const leaderboardPromise = getDungeonLeaderboard(normalizedChainId, { mode: "general" });
  const [rawAgent, rawClanState, owner, leaderboard] = await Promise.all([
    contract.getAgentData(BigInt(tokenId)),
    contract.getClanState(BigInt(tokenId)),
    contract.ownerOf(BigInt(tokenId)),
    leaderboardPromise,
  ]);

  const clanState = normalizeClanState(rawClanState);
  const entryIndex = leaderboard.entries.findIndex((entry) => entry.tokenId === tokenId);
  const entry = entryIndex >= 0 ? leaderboard.entries[entryIndex] : null;
  const metadataHash = String(rawAgent.metadataHash ?? rawAgent[0] ?? "");
  const proofs: AgentPassportProof[] = [];
  addProof(proofs, "metadata-hash", metadataHash, "0g-chain");
  addProof(proofs, "memory-root", clanState.memoryRoot, "0g-storage");
  addProof(proofs, "realm-root", clanState.realmRoot, "0g-storage");
  addProof(proofs, "vote-root", clanState.voteRoot, "0g-storage");

  const standing = {
    rank: entryIndex >= 0 ? entryIndex + 1 : null,
    lifetimeXp: entry?.totalXpEarned ?? 0,
    highestRunXp: entry?.highestRunXp ?? 0,
    verifiedClears: entry?.completedRuns ?? 0,
    bossKills: entry?.bossKills ?? 0,
    currentLevel: entry?.currentLevel ?? 1,
  };
  const explorerBase = normalizedChainId === 16661 ? "https://chainscan.0g.ai" : "https://chainscan-galileo.0g.ai";
  const publicBase = "https://www.0gclawforge.xyz";

  return {
    kind: "0gclawforge-agent-passport",
    version: "1.0",
    tokenId,
    chainId: normalizedChainId,
    network: normalizedChainId === 16661 ? "0G Mainnet" : "0G Galileo Testnet",
    name: String(rawAgent.agentName ?? rawAgent[2] ?? `Clan #${tokenId}`),
    owner: String(owner),
    archetype: String(rawAgent.agentPersonality ?? rawAgent[3] ?? ""),
    modelType: String(rawAgent.modelType ?? rawAgent[4] ?? ""),
    metadataHash,
    storageURI: String(rawAgent.encryptedStorageURI ?? rawAgent[1] ?? ""),
    memoryRoot: clanState.memoryRoot,
    realmRoot: clanState.realmRoot,
    voteRoot: clanState.voteRoot,
    realmCount: clanState.realmCount,
    proposalCount: clanState.proposalCount,
    evolutionCount: clanState.evolutionCount,
    skillCount: Number(rawAgent.skillCount ?? rawAgent[5] ?? 0),
    taskCount: Number(rawAgent.taskCount ?? rawAgent[6] ?? 0),
    memorySize: Number(rawAgent.memorySize ?? rawAgent[7] ?? 0),
    reputation: reputationScore({ ...standing, ...clanState }),
    standing,
    proofs,
    links: {
      passport: `${publicBase}/passport/${tokenId}`,
      realm: `${publicBase}/play/${tokenId}?spectator=1`,
      explorer: `${explorerBase}/address/${contractAddress.toLowerCase()}`,
    },
    updatedAt: Date.now(),
  };
}
