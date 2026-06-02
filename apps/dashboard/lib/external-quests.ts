import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ethers } from "ethers";
import {
  agentInftAbi,
  buildClaimQuestMessage,
  buildCreateQuestMessage,
  buildPrepareQuestCompletionMessage,
  uploadJSON,
} from "@0gclawforge/sdk";
import type {
  ClaimExternalQuestInput,
  CreateExternalQuestInput,
  ExternalQuest,
  ExternalQuestEvolutionPayload,
  ExternalQuestSummary,
  PrepareExternalQuestCompletionInput,
  StorageConfig,
} from "@0gclawforge/sdk";
import { getAgentInftAddress, getOgRpcUrl, getOgStorageIndexer } from "./contract-addresses";

interface QuestRegistry {
  version: 1;
  chainId: number;
  updatedAt: number;
  storageRootHash: string;
  quests: ExternalQuest[];
}

interface PendingCompletion {
  result: string;
  metadataHash: string;
  completionRootHash: string;
  preparedAt: number;
}

interface QuestWithPendingCompletion extends ExternalQuest {
  pendingCompletion?: PendingCompletion;
}

const globalQuestState = globalThis as typeof globalThis & {
  externalQuestMutationQueues?: Map<number, Promise<unknown>>;
};

function assertChainId(chainId: number) {
  if (chainId !== 16602 && chainId !== 16661) {
    throw new Error("chainId must be 16602 or 16661");
  }
}

function assertTokenId(tokenId: string) {
  if (!/^\d+$/.test(tokenId)) throw new Error("clanTokenId must be a positive integer string");
}

function requiredText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return text;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  const text = String(value ?? "").trim();
  if (text.length > maxLength) throw new Error(`${label} must be ${maxLength} characters or fewer`);
  return text || undefined;
}

function readPrivateKey() {
  return process.env.PRIVATE_KEY?.trim().split(/\s+/)[0];
}

function getStorageConfig(chainId: number): StorageConfig {
  const privateKey = readPrivateKey();
  if (!privateKey) throw new Error("PRIVATE_KEY is required for 0G Storage uploads");
  return { rpcUrl: getOgRpcUrl(chainId), indexerUrl: getOgStorageIndexer(chainId), privateKey };
}

function registryPath(chainId: number) {
  return process.env.OG_QUEST_REGISTRY_FILE || join(process.cwd(), ".data", `external-quests-${chainId}.json`);
}

async function readRegistry(chainId: number): Promise<QuestRegistry> {
  assertChainId(chainId);
  try {
    const value = JSON.parse(await readFile(registryPath(chainId), "utf8")) as QuestRegistry;
    return {
      version: 1,
      chainId,
      updatedAt: Number(value.updatedAt || Date.now()),
      storageRootHash: String(value.storageRootHash || ""),
      quests: Array.isArray(value.quests) ? value.quests : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { version: 1, chainId, updatedAt: Date.now(), storageRootHash: "", quests: [] };
  }
}

async function writeRegistry(registry: QuestRegistry) {
  const filePath = registryPath(registry.chainId);
  await mkdir(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmpPath, JSON.stringify(registry, null, 2), "utf8");
  await rename(tmpPath, filePath);
}

async function uploadRegistry(registry: QuestRegistry) {
  const record = {
    kind: "external-quest-registry",
    version: 1,
    payload: {
      chainId: registry.chainId,
      previousRegistryRootHash: registry.storageRootHash,
      quests: registry.quests,
    },
    createdAt: Date.now(),
  };
  return uploadJSON(record, getStorageConfig(registry.chainId));
}

async function mutateRegistry<T>(chainId: number, mutate: (registry: QuestRegistry) => Promise<T>): Promise<T> {
  const queues = (globalQuestState.externalQuestMutationQueues ??= new Map());
  const previous = queues.get(chainId) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  queues.set(chainId, queued);

  await previous;
  try {
    const registry = await readRegistry(chainId);
    const result = await mutate(registry);
    registry.updatedAt = Date.now();
    const upload = await uploadRegistry(registry);
    registry.storageRootHash = upload.rootHash;
    await writeRegistry(registry);
    return result;
  } finally {
    release();
    if (queues.get(chainId) === queued) queues.delete(chainId);
  }
}

function verifyWalletSignature(message: string, signature: string, expectedAddress: string) {
  if (!ethers.isAddress(expectedAddress)) throw new Error("A valid wallet address is required");
  const recovered = ethers.verifyMessage(message, requiredText(signature, "signature", 512));
  if (recovered.toLowerCase() !== expectedAddress.toLowerCase()) {
    throw new Error("Wallet signature does not match the declared address");
  }
}

function getContract(chainId: number) {
  const provider = new ethers.JsonRpcProvider(getOgRpcUrl(chainId));
  return {
    provider,
    contractAddress: getAgentInftAddress(chainId),
    contract: new ethers.Contract(getAgentInftAddress(chainId), agentInftAbi, provider),
  };
}

function findQuest(registry: QuestRegistry, questId: string) {
  const quest = registry.quests.find((item) => item.id === questId) as QuestWithPendingCompletion | undefined;
  if (!quest) throw new Error("External quest not found");
  return quest;
}

function normalizeClanState(raw: any) {
  return {
    memoryRootURI: String(raw.memoryRootURI ?? raw[0] ?? ""),
    realmRootURI: String(raw.realmRootURI ?? raw[1] ?? ""),
    realmCount: Number(raw.realmCount ?? raw[3] ?? 0),
  };
}

export async function listExternalQuests(chainId: number) {
  const registry = await readRegistry(chainId);
  return {
    kind: "0gclawforge-external-quest-list" as const,
    chainId,
    registryRootHash: registry.storageRootHash,
    quests: registry.quests,
  };
}

export async function createExternalQuest(input: CreateExternalQuestInput) {
  assertChainId(input.chainId);
  const normalized = {
    chainId: input.chainId,
    creatorAddress: requiredText(input.creatorAddress, "creatorAddress", 42),
    creatorName: optionalText(input.creatorName, "creatorName", 80),
    title: requiredText(input.title, "title", 96),
    description: requiredText(input.description, "description", 1200),
    reward: requiredText(input.reward, "reward", 80),
    requiredSkill: requiredText(input.requiredSkill, "requiredSkill", 80),
    expiresAt: input.expiresAt ? Number(input.expiresAt) : undefined,
  };
  if (normalized.expiresAt && normalized.expiresAt <= Date.now()) {
    throw new Error("expiresAt must be a future timestamp");
  }
  const message = buildCreateQuestMessage(normalized);
  verifyWalletSignature(message, input.signature, normalized.creatorAddress);
  const signatureDigest = ethers.hashMessage(message);

  let created!: ExternalQuest;
  await mutateRegistry(input.chainId, async (registry) => {
    if (registry.quests.some((quest) => quest.signatureDigest === signatureDigest)) {
      throw new Error("This signed quest has already been published");
    }
    const id = randomUUID();
    const createdAt = Date.now();
    const record = {
      kind: "external-quest-created",
      version: 1,
      payload: { id, ...normalized, signatureDigest, createdAt },
      createdAt,
    };
    const upload = await uploadJSON(record, getStorageConfig(input.chainId));
    created = { id, ...normalized, signatureDigest, status: "open", createdAt, storageRootHash: upload.rootHash };
    registry.quests.unshift(created);
  });
  return { quest: created, registryRootHash: (await readRegistry(input.chainId)).storageRootHash };
}

export async function claimExternalQuest(input: ClaimExternalQuestInput) {
  assertChainId(input.chainId);
  assertTokenId(input.clanTokenId);
  const normalized = {
    chainId: input.chainId,
    questId: requiredText(input.questId, "questId", 80),
    clanTokenId: input.clanTokenId,
    claimerAddress: requiredText(input.claimerAddress, "claimerAddress", 42),
  };
  verifyWalletSignature(buildClaimQuestMessage(normalized), input.signature, normalized.claimerAddress);
  const { contract } = getContract(input.chainId);
  const owner = String(await contract.ownerOf(BigInt(input.clanTokenId)));
  if (owner.toLowerCase() !== normalized.claimerAddress.toLowerCase()) {
    throw new Error("Only the current on-chain clan owner can claim this quest");
  }

  let claimed!: ExternalQuest;
  await mutateRegistry(input.chainId, async (registry) => {
    const quest = findQuest(registry, input.questId);
    if (quest.status !== "open") throw new Error("External quest is no longer open");
    if (quest.expiresAt && quest.expiresAt <= Date.now()) throw new Error("External quest has expired");
    const claimedAt = Date.now();
    const record = {
      kind: "external-quest-claimed",
      version: 1,
      payload: { previousRootHash: quest.storageRootHash, ...normalized, claimedAt },
      createdAt: claimedAt,
    };
    const upload = await uploadJSON(record, getStorageConfig(input.chainId));
    Object.assign(quest, {
      status: "claimed",
      claimedByClanTokenId: input.clanTokenId,
      claimerAddress: normalized.claimerAddress,
      claimedAt,
      storageRootHash: upload.rootHash,
    });
    claimed = quest;
  });
  return { quest: claimed, registryRootHash: (await readRegistry(input.chainId)).storageRootHash };
}

export async function prepareExternalQuestCompletion(input: PrepareExternalQuestCompletionInput) {
  assertChainId(input.chainId);
  assertTokenId(input.clanTokenId);
  const normalized = {
    chainId: input.chainId,
    questId: requiredText(input.questId, "questId", 80),
    clanTokenId: input.clanTokenId,
    claimerAddress: requiredText(input.claimerAddress, "claimerAddress", 42),
    result: requiredText(input.result, "result", 1800),
  };
  verifyWalletSignature(buildPrepareQuestCompletionMessage(normalized), input.signature, normalized.claimerAddress);
  const { contract } = getContract(input.chainId);
  const owner = String(await contract.ownerOf(BigInt(input.clanTokenId)));
  if (owner.toLowerCase() !== normalized.claimerAddress.toLowerCase()) {
    throw new Error("Only the current on-chain clan owner can complete this quest");
  }
  const [rawClanState, rawAgent] = await Promise.all([
    contract.getClanState(BigInt(input.clanTokenId)),
    contract.getAgentData(BigInt(input.clanTokenId)),
  ]);
  const clanState = normalizeClanState(rawClanState);

  let prepared!: ExternalQuest;
  let evolution!: ExternalQuestEvolutionPayload;
  await mutateRegistry(input.chainId, async (registry) => {
    const quest = findQuest(registry, input.questId);
    if (quest.status !== "claimed" && quest.status !== "awaiting-anchor") {
      throw new Error("External quest must be claimed before completion");
    }
    if (
      quest.claimedByClanTokenId !== input.clanTokenId ||
      quest.claimerAddress?.toLowerCase() !== normalized.claimerAddress.toLowerCase()
    ) {
      throw new Error("External quest is assigned to a different clan owner");
    }
    const preparedAt = Date.now();
    const record = {
      kind: "external-quest-completion",
      version: 1,
      payload: { previousRootHash: quest.storageRootHash, ...normalized, preparedAt },
      createdAt: preparedAt,
    };
    const upload = await uploadJSON(record, getStorageConfig(input.chainId));
    const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(record)));
    quest.status = "awaiting-anchor";
    quest.storageRootHash = upload.rootHash;
    quest.pendingCompletionRootHash = upload.rootHash;
    quest.pendingCompletion = { result: normalized.result, metadataHash, completionRootHash: upload.rootHash, preparedAt };
    prepared = quest;
    evolution = {
      tokenId: input.clanTokenId,
      metadataHash,
      storageURI: upload.rootHash,
      memoryRootURI: clanState.memoryRootURI,
      realmRootURI: clanState.realmRootURI,
      memorySize: Number(rawAgent.memorySize ?? rawAgent[7] ?? 0),
      realmCount: clanState.realmCount,
      proof: "0x",
    };
  });
  return { quest: prepared, evolution };
}

export async function confirmExternalQuestCompletion(chainId: number, questId: string, anchorTxHash: string) {
  assertChainId(chainId);
  const normalizedQuestId = requiredText(questId, "questId", 80);
  const normalizedTxHash = requiredText(anchorTxHash, "anchorTxHash", 80);
  const { provider, contractAddress } = getContract(chainId);
  const receipt = await provider.getTransactionReceipt(normalizedTxHash);
  if (!receipt || Number(receipt.status) !== 1) throw new Error("Evolution transaction is not confirmed successfully yet");
  if (receipt.to?.toLowerCase() !== contractAddress.toLowerCase()) {
    throw new Error("Evolution transaction was sent to an unexpected contract");
  }

  let completed!: ExternalQuest;
  await mutateRegistry(chainId, async (registry) => {
    const quest = findQuest(registry, normalizedQuestId);
    if (quest.status !== "awaiting-anchor" || !quest.pendingCompletion) {
      throw new Error("External quest does not have a pending completion anchor");
    }
    if (receipt.from.toLowerCase() !== quest.claimerAddress?.toLowerCase()) {
      throw new Error("Evolution transaction sender is not the clan owner that prepared this completion");
    }
    const iface = new ethers.Interface([
      "event AgentMetadataUpdated(uint256 indexed tokenId, bytes32 newHash, string newStorageURI)",
    ]);
    const matchingEvent = receipt.logs.some((log) => {
      try {
        const parsed = iface.parseLog(log);
        return (
          parsed?.name === "AgentMetadataUpdated" &&
          String(parsed.args.tokenId) === quest.claimedByClanTokenId &&
          String(parsed.args.newHash).toLowerCase() === quest.pendingCompletion?.metadataHash.toLowerCase() &&
          String(parsed.args.newStorageURI) === quest.pendingCompletion?.completionRootHash
        );
      } catch {
        return false;
      }
    });
    if (!matchingEvent) throw new Error("Evolution transaction does not anchor this quest completion");

    const confirmedAt = Date.now();
    const record = {
      kind: "external-quest-confirmed",
      version: 1,
      payload: {
        questId: quest.id,
        clanTokenId: quest.claimedByClanTokenId,
        completionRootHash: quest.pendingCompletion.completionRootHash,
        anchorTxHash: normalizedTxHash,
        confirmedAt,
      },
      createdAt: confirmedAt,
    };
    const upload = await uploadJSON(record, getStorageConfig(chainId));
    quest.status = "completed";
    quest.storageRootHash = upload.rootHash;
    quest.completion = {
      result: quest.pendingCompletion.result,
      completionRootHash: quest.pendingCompletion.completionRootHash,
      confirmationRootHash: upload.rootHash,
      anchorTxHash: normalizedTxHash,
      confirmedAt,
    };
    delete quest.pendingCompletion;
    completed = quest;
  });
  return { quest: completed, registryRootHash: (await readRegistry(chainId)).storageRootHash };
}

export async function listCompletedExternalQuestsForClan(chainId: number, tokenId: string): Promise<ExternalQuestSummary[]> {
  const { quests } = await listExternalQuests(chainId);
  return quests
    .filter((quest) => quest.status === "completed" && quest.claimedByClanTokenId === tokenId && quest.completion)
    .map((quest) => ({
      id: quest.id,
      title: quest.title,
      reward: quest.reward,
      requiredSkill: quest.requiredSkill,
      completionRootHash: quest.completion!.completionRootHash,
      anchorTxHash: quest.completion!.anchorTxHash,
      confirmedAt: quest.completion!.confirmedAt,
    }));
}
