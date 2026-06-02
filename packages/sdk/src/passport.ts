export interface AgentPassportProof {
  type: "metadata-hash" | "memory-root" | "realm-root" | "vote-root";
  value: string;
  source: "0g-chain" | "0g-storage";
  verified: true;
}

export interface AgentPassport {
  kind: "0gclawforge-agent-passport";
  version: "1.0";
  tokenId: string;
  chainId: number;
  network: string;
  name: string;
  owner: string;
  archetype: string;
  modelType: string;
  metadataHash: string;
  storageURI: string;
  memoryRoot: string;
  realmRoot: string;
  voteRoot: string;
  realmCount: number;
  proposalCount: number;
  evolutionCount: number;
  skillCount: number;
  taskCount: number;
  memorySize: number;
  reputation: number;
  standing: {
    rank: number | null;
    lifetimeXp: number;
    highestRunXp: number;
    verifiedClears: number;
    bossKills: number;
    currentLevel: number;
  };
  proofs: AgentPassportProof[];
  links: {
    passport: string;
    realm: string;
    explorer: string;
  };
  updatedAt: number;
}

export interface GetAgentPassportOptions {
  chainId?: 16602 | 16661;
  apiBaseUrl?: string;
  fetch?: typeof fetch;
}

export async function getAgentPassport(
  tokenId: string | number,
  options: GetAgentPassportOptions = {}
): Promise<AgentPassport> {
  const normalizedTokenId = String(tokenId);
  if (!/^\d+$/.test(normalizedTokenId)) {
    throw new Error("tokenId must be a positive integer string");
  }

  const apiBaseUrl = (options.apiBaseUrl || "https://www.0gclawforge.xyz").replace(/\/+$/, "");
  const request = options.fetch || globalThis.fetch;
  if (!request) {
    throw new Error("A fetch implementation is required to read an agent passport");
  }

  const query = options.chainId ? `?chainId=${options.chainId}` : "";
  const response = await request(`${apiBaseUrl}/api/passport/${normalizedTokenId}${query}`);
  const payload = (await response.json()) as AgentPassport & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error || `Failed to load passport for clan #${normalizedTokenId}`);
  }

  return payload;
}
