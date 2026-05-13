import type { VerifiableInference } from "@0gclawforge/compute";
import type { PermanentMemory } from "@0gclawforge/storage";

export interface RealmAsset {
  readonly type: "biome" | "npc" | "quest" | "artifact";
  readonly name: string;
  readonly description: string;
}

export interface UGCRealm {
  readonly id: string;
  readonly prompt: string;
  readonly title: string;
  readonly lore: string;
  readonly assets: readonly RealmAsset[];
  readonly createdAt: number;
  readonly storageRootHash?: string;
}

export interface EvolutionProposal {
  readonly id: string;
  readonly clanId: string;
  readonly text: string;
  readonly yesVotes: number;
  readonly noVotes: number;
  readonly createdAt: number;
  readonly status: "open" | "passed" | "rejected" | "executed";
}

export interface EvolutionExecution {
  readonly proposal: EvolutionProposal;
  readonly realm: UGCRealm;
  readonly verified: boolean;
  readonly memoryRootHash: string;
  readonly recordRootHash: string;
}

const slug = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 48) || "realm";

export async function generateRealmFromPrompt(
  prompt: string,
  inference?: VerifiableInference
): Promise<UGCRealm> {
  const inferred = inference
    ? await inference.run(`Generate a compact Eternal Clans realm spec from this OpenClaw prompt: ${prompt}`, {
        systemPrompt: "Return premium fantasy game realm content. Keep it concise.",
        temperature: 0.55,
        maxTokens: 700,
      })
    : null;

  const source = inferred?.text || prompt;
  const title = `${prompt.split(/\s+/).slice(0, 4).join(" ")} Realm`.trim();

  return {
    id: `realm-${slug(prompt)}-${Date.now()}`,
    prompt,
    title,
    lore: source.slice(0, 900),
    assets: [
      { type: "biome", name: "Anchor Biome", description: `A permanent world space shaped by: ${prompt}` },
      { type: "npc", name: "Memory Warden", description: "An NPC that recalls clan history from 0G Storage." },
      { type: "quest", name: "First Echo", description: "A starter quest that proves the realm can evolve without context loss." },
      { type: "artifact", name: "Clan Sigil", description: "A tradable identity artifact bound to the clan iNFT." },
    ],
    createdAt: Date.now(),
  };
}

export function createEvolutionProposal(clanId: string, text: string): EvolutionProposal {
  return {
    id: `proposal-${slug(text)}-${Date.now()}`,
    clanId,
    text,
    yesVotes: 0,
    noVotes: 0,
    createdAt: Date.now(),
    status: "open",
  };
}

export function voteOnProposal(proposal: EvolutionProposal, support: boolean): EvolutionProposal {
  return {
    ...proposal,
    yesVotes: proposal.yesVotes + (support ? 1 : 0),
    noVotes: proposal.noVotes + (support ? 0 : 1),
  };
}

export async function executeWinningEvolution(
  proposal: EvolutionProposal,
  memory: PermanentMemory,
  currentMemoryRoot: string | null,
  inference?: VerifiableInference
): Promise<EvolutionExecution> {
  const finalProposal: EvolutionProposal = {
    ...proposal,
    status: proposal.yesVotes >= proposal.noVotes ? "executed" : "rejected",
  };
  const realm = await generateRealmFromPrompt(proposal.text, inference);
  const record = await memory.commitRecord("evolution", proposal.clanId, { proposal: finalProposal, realm });
  const memoryCommit = await memory.appendClanMemory(
    currentMemoryRoot,
    proposal.clanId,
    `COMMUNITY EVOLUTION: ${proposal.text}\nREALM UPDATE: ${realm.title}`,
    ["evolution", "community-vote", "realm"],
    0.95
  );

  return {
    proposal: finalProposal,
    realm: { ...realm, storageRootHash: record.rootHash },
    verified: true,
    memoryRootHash: memoryCommit.rootHash,
    recordRootHash: record.rootHash,
  };
}

export * from "./depin";
export * from "./quests";
export * from "./social";
export * from "./runtime";
