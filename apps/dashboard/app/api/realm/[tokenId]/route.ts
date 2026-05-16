import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { agentInftAbi, downloadFromStorage, uploadJSON } from "@0gclawforge/sdk";
import type { StorageConfig } from "@0gclawforge/sdk";
import { getAgentInftAddress, getOgRpcUrl, getOgStorageIndexer } from "../../../../lib/contract-addresses";

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
  chainId?: number;
  progress: RealmProgress;
}

function readPrivateKey(): string | undefined {
  return process.env.PRIVATE_KEY?.trim().split(/\s+/)[0];
}

function getStorageConfig(chainId: number, requirePrivateKey = false): StorageConfig {
  const rpcUrl = getOgRpcUrl(chainId);
  const indexerUrl = getOgStorageIndexer(chainId);
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
  const rpcUrl = getOgRpcUrl(useMainnet ? 16661 : 16602);
  const address = getAgentInftAddress(useMainnet ? 16661 : 16602);

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

function cleanRealmText(value: unknown, maxLength = 900) {
  let text = String(value ?? "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .trim();

  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function extractRealmJsonField(value: unknown, field: "title" | "lore", maxLength = 900) {
  const text = String(value ?? "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .replace(/\\n/g, " ")
    .replace(/\\"/g, '"')
    .trim();

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    const candidate = text.slice(jsonStart, jsonEnd + 1);
    try {
      const parsed = JSON.parse(candidate);
      const extracted = parsed?.[field];
      if (typeof extracted === "string") return cleanRealmText(extracted, maxLength);
    } catch {
      // Fall through to partial JSON extraction below.
    }
  }

  const match = text.match(new RegExp(`"${field}"\\s*:\\s*"([^"]+)`));
  return match?.[1] ? cleanRealmText(match[1], maxLength) : "";
}

function normalizeRealmRecord(record: any, tokenId: string, version: number) {
  const payload = record?.payload ?? record;
  const generated = payload?.realmGenerated ?? record?.realmGenerated;
  const candidate =
    payload?.title && Array.isArray(payload.assets)
      ? payload
      : generated?.title && Array.isArray(generated.assets)
        ? generated
        : null;

  if (!candidate) {
    throw new Error("Storage record is not a playable realm payload");
  }

  const prompt = cleanRealmText(candidate.prompt ?? payload?.prompt ?? payload?.proposal ?? "", 320);
  const rawTitle = cleanRealmText(candidate.title, 96);
  const embeddedTitle = extractRealmJsonField(candidate.lore, "title", 96);
  const title = rawTitle && !/ realm$/i.test(rawTitle) ? rawTitle : embeddedTitle || rawTitle || `Clan #${tokenId} Realm`;
  const lore =
    extractRealmJsonField(candidate.lore, "lore", 900) ||
    cleanRealmText(candidate.lore, 900) ||
    (prompt ? `A playable clan realm forged from the vision: ${prompt}.` : "A playable clan realm stored on 0G.");
  const assets = candidate.assets
    .filter((asset: any) => ["biome", "npc", "quest", "artifact"].includes(asset?.type))
    .map((asset: any) => ({
      type: asset.type,
      name: cleanRealmText(asset.name, 96) || `${asset.type} asset`,
      description: cleanRealmText(asset.description, 260) || `A ${asset.type} bound to ${title}.`,
    }));

  if (assets.length === 0) {
    throw new Error("Playable realm has no usable assets");
  }

  return {
    kind: "ugc-realm",
    payload: {
      tokenId: String(candidate.tokenId ?? payload?.tokenId ?? tokenId),
      prompt,
      title,
      lore,
      assets,
      version: Number(candidate.version ?? payload?.version ?? version),
      previousRealmRootURI: candidate.previousRealmRootURI ?? payload?.previousRealmRootURI,
      visualTheme: candidate.visualTheme,
      map: candidate.map,
      layout: candidate.layout,
    },
    network: record?.network,
    createdAt: record?.createdAt ?? Date.now(),
  };
}

async function downloadRealmRecord(rootHash: string, tokenId: string, chainId: number) {
  const tmpPath = join(tmpdir(), `0gclawforge-realm-${tokenId}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
  try {
    await downloadFromStorage(rootHash, tmpPath, getStorageConfig(chainId, false));
    return JSON.parse(await readFile(tmpPath, "utf8"));
  } catch (err) {
    // Realm may have been uploaded on a different network's storage indexer — try testnet fallback
    if (chainId !== 16602) {
      await rm(tmpPath, { force: true });
      const fallbackPath = join(tmpdir(), `0gclawforge-realm-${tokenId}-fb-${Date.now()}.json`);
      try {
        await downloadFromStorage(rootHash, fallbackPath, getStorageConfig(16602, false));
        return JSON.parse(await readFile(fallbackPath, "utf8"));
      } finally {
        await rm(fallbackPath, { force: true });
      }
    }
    throw err;
  } finally {
    await rm(tmpPath, { force: true });
  }
}

export async function GET(req: NextRequest, { params }: { params: { tokenId: string } }) {
  const { tokenId } = params;

  try {
    assertTokenId(tokenId);
    const requestedChainId = req.nextUrl.searchParams.get("chainId");
    const chainId = requestedChainId === "16661" ? 16661 : 16602;
    const { rpcUrl, address } = getContractConfig(requestedChainId);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, agentInftAbi, provider);
    const clanState = normalizeClanState(await contract.getClanState(BigInt(tokenId)));
    const requestedRealmRoot = req.nextUrl.searchParams.get("realmRoot") || "";

    if (!requestedRealmRoot && !clanState.realmRootURI) {
      return NextResponse.json({ error: "Clan has no realm root yet", clanState }, { status: 404 });
    }

    const activeRoot = requestedRealmRoot || clanState.realmRootURI;
    const rawRealm = await downloadRealmRecord(activeRoot, tokenId, chainId);
    const realm = normalizeRealmRecord(rawRealm, tokenId, Math.max(1, clanState.realmCount));
    const history: Array<{ rootHash: string; title: string; createdAt: number; version: number; current: boolean }> = [];
    const seen = new Set<string>();
    let nextRoot = activeRoot;
    let depth = 0;

    while (nextRoot && !seen.has(nextRoot) && depth < 12) {
      seen.add(nextRoot);
      const rawRecord = depth === 0 ? rawRealm : await downloadRealmRecord(nextRoot, tokenId, chainId);
      const record = normalizeRealmRecord(rawRecord, tokenId, Math.max(1, clanState.realmCount - depth));
      history.push({
        rootHash: nextRoot,
        title: record.payload.title || `Realm Version ${history.length + 1}`,
        createdAt: record.createdAt || Date.now(),
        version: Number(record.payload.version || Math.max(1, clanState.realmCount - depth)),
        current: nextRoot === activeRoot,
      });
      nextRoot = typeof record.payload.previousRealmRootURI === "string" ? record.payload.previousRealmRootURI : "";
      depth += 1;
    }

    return NextResponse.json({ realm, clanState, history });
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
    const chainId = Number(body.chainId || req.nextUrl.searchParams.get("chainId") || process.env.NEXT_PUBLIC_OG_CHAIN_ID || 16602);

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
        chainId,
        storageIndexer: getOgStorageIndexer(chainId),
      },
      createdAt: Date.now(),
    };

    const upload = await uploadJSON(record, getStorageConfig(chainId, true));

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
