import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { agentInftAbi, MemoryEngine } from "@0gclawforge/sdk";
import { getAgentInftAddress, getOgRpcUrl, getOgStorageIndexer } from "../../../lib/contract-addresses";

function getStorageConfig(chainId: number, requirePrivateKey = false) {
  const rpcUrl = getOgRpcUrl(chainId);
  const indexerUrl = getOgStorageIndexer(chainId);
  const privateKey = process.env.PRIVATE_KEY?.trim().split(/\s+/)[0];

  if (!rpcUrl || !indexerUrl) {
    throw new Error("0G Storage RPC and indexer are not configured");
  }
  if (requirePrivateKey && !privateKey) {
    throw new Error("PRIVATE_KEY is required to append clan memory");
  }

  return { rpcUrl, indexerUrl, privateKey };
}

async function resolveMemoryRoot(tokenId: string, chainId: number) {
  const provider = new ethers.JsonRpcProvider(getOgRpcUrl(chainId));
  const contract = new ethers.Contract(getAgentInftAddress(chainId), agentInftAbi, provider);
  const state = await contract.getClanState(BigInt(tokenId));
  return String(state.memoryRootURI ?? state[0] ?? "");
}

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("tokenId");
  const query = req.nextUrl.searchParams.get("query");
  const requestedRootHash = req.nextUrl.searchParams.get("rootHash");
  const chainId = Number(req.nextUrl.searchParams.get("chainId") || 16661);

  if (!tokenId || !query) {
    return NextResponse.json({ error: "tokenId and query required" }, { status: 400 });
  }

  try {
    const rootHash = requestedRootHash || (await resolveMemoryRoot(tokenId, chainId));
    if (!rootHash) {
      return NextResponse.json({ entries: [], totalCount: 0, storageRootHash: null, chainId });
    }

    let entries = await new MemoryEngine(getStorageConfig(chainId)).queryMemory(rootHash, query);
    if (entries.length === 0 && chainId !== 16602) {
      entries = await new MemoryEngine(getStorageConfig(16602)).queryMemory(rootHash, query);
    }

    return NextResponse.json({
      entries,
      totalCount: entries.length,
      storageRootHash: rootHash,
      chainId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenId, content, tags, importance, rootHash, sessionId } = body;
    const chainId = Number(body.chainId || 16661);

    if (!tokenId || !content) {
      return NextResponse.json({ error: "tokenId and content required" }, { status: 400 });
    }

    const currentRootHash = rootHash || (await resolveMemoryRoot(String(tokenId), chainId));
    const engine = new MemoryEngine(getStorageConfig(chainId, true));

    const result = await engine.appendMemory(
      currentRootHash || null,
      `agent_${tokenId}`,
      {
        agentId: `agent_${tokenId}`,
        content,
        tags: tags ?? [],
        sessionId: sessionId ?? `session_${Date.now()}`,
        importance: importance ?? 0.5,
      }
    );

    return NextResponse.json({
      success: true,
      rootHash: result.rootHash,
      memorySize: result.memorySize,
      chainId,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
