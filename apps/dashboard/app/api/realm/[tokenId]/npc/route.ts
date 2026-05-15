import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { downloadFromStorage, ZGComputeClient, type StorageConfig } from "@0gclawforge/sdk";
import { ethers } from "ethers";
import { agentInftAbi } from "@0gclawforge/sdk";
import {
  getAgentInftAddress,
  getOgComputeProviderAddress,
  getOgRpcUrl,
  getOgStorageIndexer,
} from "../../../../../lib/contract-addresses";

const AUTONOMOUS_MODEL_NAME = "0GM-1.0-35B-A3B";

function readPrivateKey(): string | undefined {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  return privateKey?.split(/\s+/)[0];
}

function getStorageConfig(chainId: number): StorageConfig {
  const rpcUrl = getOgRpcUrl(chainId);
  const indexerUrl = getOgStorageIndexer(chainId);
  if (!rpcUrl || !indexerUrl) throw new Error("0G Storage endpoints are not configured");
  return { rpcUrl, indexerUrl, privateKey: readPrivateKey() };
}

function getComputeConfig(chainId: number) {
  const rpcUrl = getOgRpcUrl(chainId);
  const privateKey = readPrivateKey();
  const providerAddress = getOgComputeProviderAddress(chainId);
  if (!rpcUrl || !privateKey || !providerAddress) return null;
  return { rpcUrl, privateKey, providerAddress };
}

function normalizeClanState(raw: any) {
  return {
    realmRootURI: raw.realmRootURI ?? String(raw[1] ?? ""),
  };
}

async function downloadRealm(rootHash: string, tokenId: string, chainId: number) {
  const tmpPath = join(tmpdir(), `0gclawforge-npc-realm-${tokenId}-${Date.now()}.json`);
  try {
    await downloadFromStorage(rootHash, tmpPath, getStorageConfig(chainId));
    return JSON.parse(await readFile(tmpPath, "utf8"));
  } catch (err) {
    if (chainId !== 16602) {
      await rm(tmpPath, { force: true });
      const fbPath = join(tmpdir(), `0gclawforge-npc-realm-${tokenId}-fb-${Date.now()}.json`);
      try {
        await downloadFromStorage(rootHash, fbPath, getStorageConfig(16602));
        return JSON.parse(await readFile(fbPath, "utf8"));
      } finally {
        await rm(fbPath, { force: true });
      }
    }
    throw err;
  } finally {
    await rm(tmpPath, { force: true });
  }
}

function fallbackNpcReply(npc: { name: string; description: string }, realm: any, stateSummary?: string) {
  const title = realm?.title || "this realm";
  const quest = realm?.assets?.find((asset: any) => asset.type === "quest")?.name || "the nearest quest marker";
  const artifact = realm?.assets?.find((asset: any) => asset.type === "artifact")?.name || "a clan artifact";
  return `${npc.name}: ${npc.description} I am speaking from local realm memory while mainnet 0G Compute is unavailable. In ${title}, recover ${artifact}, follow "${quest}", and avoid the boss until your HP and XP are ready. Current state: ${stateSummary || "unknown"}.`;
}

export async function POST(req: NextRequest, { params }: { params: { tokenId: string } }) {
  try {
    const body = await req.json();
    const chainId = Number(req.nextUrl.searchParams.get("chainId") || 16602);
    const computeConfig = getComputeConfig(chainId);

    const rpcUrl = getOgRpcUrl(chainId);
    const address = getAgentInftAddress(chainId);
    if (!rpcUrl || !address) throw new Error("Clan contract configuration is missing.");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, agentInftAbi, provider);
    const clanState = normalizeClanState(await contract.getClanState(BigInt(params.tokenId)));
    if (!clanState.realmRootURI) throw new Error("Clan has no active realm.");

    const realmRecord = await downloadRealm(clanState.realmRootURI, params.tokenId, chainId);
    const realm = realmRecord.payload;
    const npc =
      realm.assets.find((asset: any) => asset.type === "npc" && asset.name === body.npcName) ||
      {
        type: "npc",
        name: typeof body.npcName === "string" && body.npcName.trim() ? body.npcName.trim() : "Realm Keeper",
        description: "A realm guide reconstructed from the active clan world's local memory.",
      };

    if (!computeConfig) {
      return NextResponse.json({
        npcName: npc.name,
        reply: fallbackNpcReply(npc, realm, body.stateSummary),
        memorySignal: "local-realm-memory",
        fallback: true,
        warning: chainId === 16661
          ? "Mainnet 0G Compute provider is not configured. Set OG_COMPUTE_PROVIDER_ADDR_MAINNET to enable verified inference."
          : "0G Compute provider is not configured.",
      });
    }

    try {
      const client = new ZGComputeClient(computeConfig);
      await client.setupProvider(computeConfig.providerAddress);

      const result = await client.query(
        `You are ${npc.name} inside the realm "${realm.title}", directed by ${AUTONOMOUS_MODEL_NAME}.

Realm prompt: ${realm.prompt}
Realm lore: ${realm.lore}
NPC base description: ${npc.description}
Player state summary: ${body.stateSummary || "Unknown"}
Recent interactions: ${Array.isArray(body.recentLog) ? body.recentLog.join(" | ") : "None"}

Respond as the NPC in 2-4 sentences. Give concrete guidance tied to the current realm map, quests, artifacts, boss, or player progress. End with one actionable hint.`,
      {
        systemPrompt: `You are a live NPC memory engine for a permanent 0G clan realm. Use ${AUTONOMOUS_MODEL_NAME} style: practical agentic reasoning, tool-use flavored hints, and concise world-state awareness. Stay in character and return plain text only.`,
        temperature: 0.7,
        maxTokens: 220,
      }
    );

      return NextResponse.json({
        npcName: npc.name,
        reply: result.text.trim(),
        memorySignal: result.verified ? "verified-0g-compute" : "unverified-0g-compute",
      });
    } catch (error) {
      const warning = error instanceof Error ? error.message : "0G Compute request failed.";
      return NextResponse.json({
        npcName: npc.name,
        reply: fallbackNpcReply(npc, realm, body.stateSummary),
        memorySignal: "local-realm-memory",
        fallback: true,
        warning,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown NPC compute error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
