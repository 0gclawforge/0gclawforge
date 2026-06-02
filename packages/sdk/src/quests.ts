export type ExternalQuestStatus = "open" | "claimed" | "awaiting-anchor" | "completed";

export interface ExternalQuestCompletion {
  result: string;
  completionRootHash: string;
  confirmationRootHash: string;
  anchorTxHash: string;
  confirmedAt: number;
}

export interface ExternalQuest {
  id: string;
  chainId: number;
  title: string;
  description: string;
  reward: string;
  requiredSkill: string;
  creatorAddress: string;
  creatorName?: string;
  signatureDigest: string;
  status: ExternalQuestStatus;
  createdAt: number;
  expiresAt?: number;
  storageRootHash: string;
  claimedByClanTokenId?: string;
  claimerAddress?: string;
  claimedAt?: number;
  pendingCompletionRootHash?: string;
  completion?: ExternalQuestCompletion;
}

export interface ExternalQuestSummary {
  id: string;
  title: string;
  reward: string;
  requiredSkill: string;
  completionRootHash: string;
  anchorTxHash: string;
  confirmedAt: number;
}

export interface ExternalQuestList {
  kind: "0gclawforge-external-quest-list";
  chainId: number;
  registryRootHash: string;
  quests: ExternalQuest[];
}

interface QuestApiOptions {
  apiBaseUrl?: string;
  fetch?: typeof fetch;
}

export interface CreateExternalQuestInput {
  chainId: number;
  creatorAddress: string;
  creatorName?: string;
  title: string;
  description: string;
  reward: string;
  requiredSkill: string;
  expiresAt?: number;
  signature: string;
}

export interface ClaimExternalQuestInput {
  chainId: number;
  questId: string;
  clanTokenId: string;
  claimerAddress: string;
  signature: string;
}

export interface PrepareExternalQuestCompletionInput {
  chainId: number;
  questId: string;
  clanTokenId: string;
  claimerAddress: string;
  result: string;
  signature: string;
}

export interface ConfirmExternalQuestCompletionInput {
  chainId: number;
  questId: string;
  anchorTxHash: string;
}

export interface ExternalQuestEvolutionPayload {
  tokenId: string;
  metadataHash: string;
  storageURI: string;
  memoryRootURI: string;
  realmRootURI: string;
  memorySize: number;
  realmCount: number;
  proof: "0x";
}

function clean(value: string) {
  return value.trim();
}

function normalizedAddress(value: string) {
  return clean(value).toLowerCase();
}

export function buildCreateQuestMessage(input: Omit<CreateExternalQuestInput, "signature">) {
  return [
    "0GClawForge External Quest",
    "Action: create",
    `Chain ID: ${input.chainId}`,
    `Creator: ${normalizedAddress(input.creatorAddress)}`,
    `Creator Name: ${clean(input.creatorName || "")}`,
    `Title: ${clean(input.title)}`,
    `Description: ${clean(input.description)}`,
    `Reward: ${clean(input.reward)}`,
    `Required Skill: ${clean(input.requiredSkill)}`,
    `Expires At: ${input.expiresAt || 0}`,
  ].join("\n");
}

export function buildClaimQuestMessage(input: Omit<ClaimExternalQuestInput, "signature">) {
  return [
    "0GClawForge External Quest",
    "Action: claim",
    `Chain ID: ${input.chainId}`,
    `Quest ID: ${clean(input.questId)}`,
    `Clan Token ID: ${clean(input.clanTokenId)}`,
    `Claimer: ${normalizedAddress(input.claimerAddress)}`,
  ].join("\n");
}

export function buildPrepareQuestCompletionMessage(
  input: Omit<PrepareExternalQuestCompletionInput, "signature">
) {
  return [
    "0GClawForge External Quest",
    "Action: prepare-completion",
    `Chain ID: ${input.chainId}`,
    `Quest ID: ${clean(input.questId)}`,
    `Clan Token ID: ${clean(input.clanTokenId)}`,
    `Claimer: ${normalizedAddress(input.claimerAddress)}`,
    `Result: ${clean(input.result)}`,
  ].join("\n");
}

async function requestQuestApi<T>(path: string, options: QuestApiOptions, init?: RequestInit): Promise<T> {
  const apiBaseUrl = (options.apiBaseUrl ?? "https://www.0gclawforge.xyz").replace(/\/+$/, "");
  const request = options.fetch || globalThis.fetch;
  if (!request) throw new Error("A fetch implementation is required to use the quest API");

  const response = await request(`${apiBaseUrl}${path}`, init);
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || "External quest request failed");
  return payload;
}

export function listExternalQuests(chainId: number, options: QuestApiOptions = {}) {
  return requestQuestApi<ExternalQuestList>(`/api/quests?chainId=${chainId}`, options);
}

export function createExternalQuest(input: CreateExternalQuestInput, options: QuestApiOptions = {}) {
  return requestQuestApi<{ quest: ExternalQuest; registryRootHash: string }>("/api/quests", options, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "create", ...input }),
  });
}

export function claimExternalQuest(input: ClaimExternalQuestInput, options: QuestApiOptions = {}) {
  return requestQuestApi<{ quest: ExternalQuest; registryRootHash: string }>("/api/quests", options, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "claim", ...input }),
  });
}

export function prepareExternalQuestCompletion(
  input: PrepareExternalQuestCompletionInput,
  options: QuestApiOptions = {}
) {
  return requestQuestApi<{ quest: ExternalQuest; evolution: ExternalQuestEvolutionPayload }>(
    "/api/quests",
    options,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "prepareCompletion", ...input }),
    }
  );
}

export function confirmExternalQuestCompletion(
  input: ConfirmExternalQuestCompletionInput,
  options: QuestApiOptions = {}
) {
  return requestQuestApi<{ quest: ExternalQuest; registryRootHash: string }>("/api/quests", options, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "confirmCompletion", ...input }),
  });
}
