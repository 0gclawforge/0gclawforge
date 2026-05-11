import { NextRequest, NextResponse } from "next/server";
import { MemoryEngine } from "@0gclawforge/sdk";

function getStorageConfig() {
  const rpcUrl = process.env.NEXT_PUBLIC_OG_RPC_URL;
  const indexerUrl = process.env.OG_STORAGE_INDEXER_TURBO;
  const privateKey = process.env.PRIVATE_KEY;

  if (!rpcUrl || !indexerUrl || !privateKey) {
    throw new Error("0G Storage not configured: need RPC URL, indexer URL, and PRIVATE_KEY");
  }

  return { rpcUrl, indexerUrl, privateKey };
}

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("tokenId");
  const query = req.nextUrl.searchParams.get("query");
  const rootHash = req.nextUrl.searchParams.get("rootHash");

  if (!tokenId || !query) {
    return NextResponse.json({ error: "tokenId and query required" }, { status: 400 });
  }

  if (!rootHash) {
    return NextResponse.json({ entries: [], totalCount: 0, storageRootHash: null });
  }

  try {
    const engine = new MemoryEngine(getStorageConfig());
    const entries = await engine.queryMemory(rootHash, query);

    return NextResponse.json({
      entries,
      totalCount: entries.length,
      storageRootHash: rootHash,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tokenId, content, tags, importance, rootHash, sessionId } = body;

    if (!tokenId || !content) {
      return NextResponse.json({ error: "tokenId and content required" }, { status: 400 });
    }

    const engine = new MemoryEngine(getStorageConfig());

    const result = await engine.appendMemory(
      rootHash ?? null,
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
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
