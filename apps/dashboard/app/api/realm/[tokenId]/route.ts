import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { agentInftAbi, downloadFromStorage, uploadJSON } from "@0gclawforge/sdk";
import type { StorageConfig } from "@0gclawforge/sdk";

interface RealmProgress {
  completed: boolean;
  hp: number;
  xp: number;
  gold: number;
  level: number;
  inventory: Array<{ name: string; description: string; type: string }>;
  questsCompleted: string[];
  bossDefeated: boolean;
  playerAddress: string;
  completedAt?: number;
}

interface SaveProgressBody {
  action: "saveProgress";
  tokenId: string;
  progress: RealmProgress;
}

function readPrivateKey(): string | undefined {
  return process.env.PRIVATE_KEY?.trim().split(/\s+/)[0];
}

function getStorageConfig(requirePrivateKey = false): StorageConfig {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const indexerUrl =
    process.env.VITE_STORAGE_INDEXER ||
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
    process.env.OG_STORAGE_INDEXER_TURBO;
  const privateKey = readPrivateKey();

  if (!rpcUrl || !indexerUrl) {
    throw new Error("0G Storage endpoints are not configured");
  }

  if (requirePrivateKey && !privateKey) {
    throw new Error("PRIVATE_KEY is required for 0G Storage uploads");
  }

  return { rpcUrl, indexerUrl, privateKey };
}

function getContractConfig(chainId?: string | null) {
  const useMainnet = chainId === "16661";
  const rpcUrl = useMainnet
    ? process.env.NEXT_PUBLIC_OG_MAINNET_RPC_URL || process.env.VITE_MAINNET_RPC_URL || "https://evmrpc.0g.ai"
    : process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL || "https://evmrpc-testnet.0g.ai";
  const address = useMainnet
    ? process.env.NEXT_PUBLIC_AGENT_INFT_MAINNET_ADDRESS || process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS
    : process.env.NEXT_PUBLIC_AGENT_INFT_ADDRESS;

  if (!address) {
    throw new Error("Agent iNFT contract address is not configured");
  }

  return { rpcUrl, address };
}

function normalizeClanState(raw: unknown) {
  const state = raw as {
    memoryRootURI?: string;
    realmRootURI?: string;
    voteRootURI?: string;
    realmCount?: bigint;
    proposalCount?: bigint;
    evolutionCount?: bigint;
    [index: number]: unknown;
  };

  return {
    memoryRootURI: state.memoryRootURI ?? String(state[0] ?? ""),
    realmRootURI: state.realmRootURI ?? String(state[1] ?? ""),
    voteRootURI: state.voteRootURI ?? String(state[2] ?? ""),
    realmCount: Number(state.realmCount ?? state[3] ?? 0),
    proposalCount: Number(state.proposalCount ?? state[4] ?? 0),
    evolutionCount: Number(state.evolutionCount ?? state[5] ?? 0),
  };
}

function assertTokenId(tokenId: string) {
  if (!/^\d+$/.test(tokenId)) {
    throw new Error("tokenId must be a positive integer string");
  }
}

export async function GET(req: NextRequest, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;

  try {
    assertTokenId(tokenId);
    const { rpcUrl, address } = getContractConfig(req.nextUrl.searchParams.get("chainId"));
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, agentInftAbi, provider);
    const clanState = normalizeClanState(await contract.getClanState(BigInt(tokenId)));

    if (!clanState.realmRootURI) {
      return NextResponse.json({ error: "Clan has no realm root yet", clanState }, { status: 404 });
    }

    const tmpPath = join(tmpdir(), `0gclawforge-realm-${tokenId}-${Date.now()}.json`);

    try {
      await downloadFromStorage(clanState.realmRootURI, tmpPath, getStorageConfig(false));
      const realm = JSON.parse(await readFile(tmpPath, "utf8"));
      return NextResponse.json({ realm, clanState });
    } finally {
      await rm(tmpPath, { force: true });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown realm API error";
    console.error("Realm GET failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;

  try {
    assertTokenId(tokenId);
    const body = (await req.json()) as SaveProgressBody;

    if (body.action !== "saveProgress") {
      return NextResponse.json({ error: "Unsupported realm action" }, { status: 400 });
    }

    if (body.tokenId !== tokenId) {
      return NextResponse.json({ error: "Request tokenId does not match route tokenId" }, { status: 400 });
    }

    if (!body.progress?.playerAddress) {
      return NextResponse.json({ error: "progress.playerAddress is required" }, { status: 400 });
    }

    const record = {
      kind: "realm-progress",
      payload: {
        tokenId,
        ...body.progress,
        completedAt: body.progress.completedAt ?? Date.now(),
      },
      network: {
        chainId: Number(process.env.VITE_CHAIN_ID || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602),
        storageIndexer:
          process.env.VITE_STORAGE_INDEXER ||
          process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
          process.env.OG_STORAGE_INDEXER_TURBO,
      },
      createdAt: Date.now(),
    };

    const upload = await uploadJSON(record, getStorageConfig(true));

    return NextResponse.json({
      progressRootHash: upload.rootHash,
      storageURI: upload.rootHash,
      storageTxHash: upload.txHash,
      record,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown realm progress API error";
    console.error("Realm POST failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
