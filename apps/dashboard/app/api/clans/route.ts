import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { uploadJSON, ZGComputeClient } from "@0gclawforge/sdk";

interface ClanApiBody {
  action: "prepareMint" | "storeRealm" | "storeVote" | "storeEvolution" | "recordMemoryEntry";
  clanName?: string;
  archetype?: string;
  mission?: string;
  owner?: string;
  tokenId?: string;
  prompt?: string;
  proposal?: string;
  yesVotes?: number;
  noVotes?: number;
  currentRealmCount?: number;
  executor?: string;
  entry?: string;
}

function readPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for 0G Storage uploads");
  }
  return privateKey.split(/\s+/)[0];
}

function getComputeConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const providerAddress = process.env.OG_COMPUTE_PROVIDER_ADDR;
  if (!rpcUrl || !providerAddress) return null;
  return { rpcUrl, privateKey: readPrivateKey(), providerAddress };
}

async function generateRealmWithInference(prompt: string): Promise<{ title: string; lore: string; assets: Array<{ type: string; name: string; description: string }> }> {
  const computeConfig = getComputeConfig();
  if (!computeConfig) {
    return fallbackRealm(prompt);
  }

  try {
    const client = new ZGComputeClient(computeConfig);
    await client.setupProvider(computeConfig.providerAddress);

    const result = await client.query(
      `Generate a detailed Eternal Clans realm from this prompt: ${prompt}\n\nReturn JSON with keys: title (string), lore (string, 2-3 sentences), assets (array of {type: "biome"|"npc"|"quest"|"artifact", name: string, description: string}).`,
      {
        systemPrompt: "You are an OpenClaw realm architect. Generate rich, unique fantasy game realm content. Return only valid JSON.",
        temperature: 0.55,
        maxTokens: 700,
      }
    );

    try {
      const parsed = JSON.parse(result.text);
      return {
        title: parsed.title || `${prompt.split(/\s+/).slice(0, 4).join(" ")} Realm`,
        lore: parsed.lore || result.text.slice(0, 500),
        assets: Array.isArray(parsed.assets) ? parsed.assets : fallbackRealm(prompt).assets,
      };
    } catch {
      return {
        title: `${prompt.split(/\s+/).slice(0, 4).join(" ")} Realm`,
        lore: result.text.slice(0, 500),
        assets: fallbackRealm(prompt).assets,
      };
    }
  } catch (error) {
    console.error("0G Compute realm generation failed, using fallback realm", error);
    return fallbackRealm(prompt);
  }
}

function fallbackRealm(prompt: string) {
  return {
    title: `${prompt.split(/\s+/).slice(0, 5).join(" ")} Realm`,
    lore: prompt,
    assets: [
      { type: "biome", name: "Anchor Biome", description: `A permanent world space shaped by: ${prompt}` },
      { type: "npc", name: "Memory Warden", description: "An NPC that recalls clan history from 0G Storage." },
      { type: "quest", name: "First Echo", description: "A starter quest that proves the realm can evolve." },
      { type: "artifact", name: "Clan Sigil", description: "A tradable identity artifact bound to the clan iNFT." },
    ],
  };
}

function getStorageConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const indexerUrl =
    process.env.VITE_STORAGE_INDEXER ||
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
    process.env.OG_STORAGE_INDEXER_TURBO;

  if (!rpcUrl || !indexerUrl) {
    throw new Error("0G Storage endpoints are not configured");
  }

  return {
    rpcUrl,
    indexerUrl,
    privateKey: readPrivateKey(),
  };
}

async function storeRecord(kind: string, payload: Record<string, unknown>) {
  const record = {
    kind,
    payload,
    network: {
      chainId: Number(process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602),
      storageIndexer:
        process.env.VITE_STORAGE_INDEXER ||
        process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
        process.env.OG_STORAGE_INDEXER_TURBO,
    },
    createdAt: Date.now(),
  };

  const upload = await uploadJSON(record, getStorageConfig());
  const metadataHash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(record)));

  return {
    ...upload,
    storageURI: upload.rootHash,
    metadataHash,
    record,
    memorySize: new TextEncoder().encode(JSON.stringify(record)).length,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ClanApiBody;

    if (body.action === "prepareMint") {
      if (!body.clanName || !body.archetype || !body.owner) {
        return NextResponse.json({ error: "clanName, archetype, and owner are required" }, { status: 400 });
      }

      const memory = await storeRecord("clan-memory-index", {
        clanName: body.clanName,
        owner: body.owner,
        entries: [
          {
            content: body.mission || body.archetype,
            tags: ["origin", "mission"],
            importance: 1,
          },
        ],
      });

      const metadata = await storeRecord("clan-metadata", {
        clanName: body.clanName,
        archetype: body.archetype,
        mission: body.mission,
        owner: body.owner,
        memoryRootURI: memory.storageURI,
        realmRootURI: "",
      });

      return NextResponse.json({
        storageURI: metadata.storageURI,
        metadataHash: metadata.metadataHash,
        memoryRootURI: memory.storageURI,
        realmRootURI: "",
        storageTxHash: metadata.txHash,
      });
    }

    if (body.action === "storeRealm") {
      if (!body.tokenId || !body.prompt) {
        return NextResponse.json({ error: "tokenId and prompt are required" }, { status: 400 });
      }

      const generated = await generateRealmWithInference(body.prompt);
      const realm = await storeRecord("ugc-realm", {
        tokenId: body.tokenId,
        prompt: body.prompt,
        title: generated.title,
        lore: generated.lore,
        assets: generated.assets,
      });

      return NextResponse.json({
        realmRootURI: realm.storageURI,
        realmCount: Number(body.currentRealmCount || 0) + 1,
        storageTxHash: realm.txHash,
      });
    }

    if (body.action === "storeVote") {
      if (!body.tokenId || !body.proposal) {
        return NextResponse.json({ error: "tokenId and proposal are required" }, { status: 400 });
      }

      const vote = await storeRecord("community-evolution-vote", {
        tokenId: body.tokenId,
        proposal: body.proposal,
        yesVotes: body.yesVotes ?? 1,
        noVotes: body.noVotes ?? 0,
      });

      return NextResponse.json({
        voteRootURI: vote.storageURI,
        proposalCount: 1,
        storageTxHash: vote.txHash,
      });
    }

    if (body.action === "storeEvolution") {
      if (!body.tokenId || !body.proposal) {
        return NextResponse.json({ error: "tokenId and proposal are required" }, { status: 400 });
      }

      const generated = body.prompt ? await generateRealmWithInference(body.prompt) : null;
      const evolution = await storeRecord("clan-evolution", {
        tokenId: body.tokenId,
        proposal: body.proposal,
        prompt: body.prompt,
        realmGenerated: generated,
        executedBy: body.executor || "unknown",
      });

      return NextResponse.json({
        metadataHash: evolution.metadataHash,
        storageURI: evolution.storageURI,
        memoryRootURI: evolution.storageURI,
        realmRootURI: evolution.storageURI,
        memorySize: evolution.memorySize,
        realmCount: Number(body.currentRealmCount || 0) + 1,
        storageTxHash: evolution.txHash,
      });
    }

    if (body.action === "recordMemoryEntry") {
      if (!body.tokenId || !body.entry) {
        return NextResponse.json({ error: "tokenId and entry are required" }, { status: 400 });
      }

      const memory = await storeRecord("clan-memory-entry", {
        tokenId: body.tokenId,
        content: body.entry,
        tags: ["realm", "completion", "gameplay"],
        importance: 1,
        executor: body.executor || "unknown",
      });

      return NextResponse.json({
        memoryRootURI: memory.storageURI,
        metadataHash: memory.metadataHash,
        storageTxHash: memory.txHash,
      });
    }

    return NextResponse.json({ error: "Unsupported clan action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown clan API error";
    console.error("Clan API error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
