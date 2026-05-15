import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { downloadFromStorage, type StorageConfig } from "@0gclawforge/sdk";
import { getOgRpcUrl, getOgStorageIndexer } from "../../../lib/contract-addresses";

function readPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("PRIVATE_KEY is required for vote retrieval.");
  return privateKey.split(/\s+/)[0];
}

function getStorageConfig(chainId: number): StorageConfig {
  const rpcUrl = getOgRpcUrl(chainId);
  const indexerUrl = getOgStorageIndexer(chainId);
  if (!rpcUrl || !indexerUrl) throw new Error("0G Storage endpoints are not configured");
  return { rpcUrl, indexerUrl, privateKey: readPrivateKey() };
}

async function downloadRecord(rootHash: string, chainId: number) {
  const tmpPath = join(tmpdir(), `0gclawforge-vote-${rootHash.slice(0, 12)}-${Date.now()}.json`);
  try {
    await downloadFromStorage(rootHash, tmpPath, getStorageConfig(chainId));
    return JSON.parse(await readFile(tmpPath, "utf8"));
  } finally {
    await rm(tmpPath, { force: true });
  }
}

export async function GET(req: NextRequest) {
  try {
    const voteRoot = req.nextUrl.searchParams.get("voteRoot");
    const chainId = Number(req.nextUrl.searchParams.get("chainId") || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602);
    if (!voteRoot?.trim()) {
      return NextResponse.json({ error: "voteRoot query parameter is required." }, { status: 400 });
    }

    const records: Array<{
      rootHash: string;
      proposal: string;
      yesVotes: number;
      noVotes: number;
      createdAt: number;
    }> = [];

    let currentRoot: string | null = voteRoot.trim();
    const maxDepth = 50;

    while (currentRoot && records.length < maxDepth) {
      try {
        const record = await downloadRecord(currentRoot, chainId);
        const payload = record.payload || record;
        records.push({
          rootHash: currentRoot,
          proposal: payload.proposal || "Unknown proposal",
          yesVotes: payload.yesVotes ?? 0,
          noVotes: payload.noVotes ?? 0,
          createdAt: record.createdAt || 0,
        });
        currentRoot = payload.previousVoteRoot || null;
      } catch {
        break;
      }
    }

    return NextResponse.json({ votes: records });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown vote fetch error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
