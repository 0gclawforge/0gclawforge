import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { uploadJSON } from "@0gclawforge/sdk";

interface ClanApiBody {
  action: "prepareMint" | "storeRealm" | "storeVote" | "storeEvolution";
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
}

function readPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for 0G Storage uploads");
  }
  return privateKey.split(/\s+/)[0];
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

      const realm = await storeRecord("ugc-realm", {
        tokenId: body.tokenId,
        prompt: body.prompt,
        title: `${body.prompt.split(/\s+/).slice(0, 5).join(" ")} Realm`,
        assets: ["biome", "npc", "quest", "artifact"],
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

      const evolution = await storeRecord("clan-evolution", {
        tokenId: body.tokenId,
        proposal: body.proposal,
        prompt: body.prompt,
        executedBy: "owner-wallet",
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

    return NextResponse.json({ error: "Unsupported clan action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown clan API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
