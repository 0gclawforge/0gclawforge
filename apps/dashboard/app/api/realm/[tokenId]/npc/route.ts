import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { NextRequest, NextResponse } from "next/server";
import { downloadFromStorage, ZGComputeClient, type StorageConfig } from "@0gclawforge/sdk";
import { ethers } from "ethers";
import { agentInftAbi } from "@0gclawforge/sdk";
import { getAgentInftAddress } from "../../../../../lib/contract-addresses";

function readPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) throw new Error("PRIVATE_KEY is required for live NPC compute.");
  return privateKey.split(/\s+/)[0];
}

function getStorageConfig(): StorageConfig {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const indexerUrl =
    process.env.VITE_STORAGE_INDEXER ||
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
    process.env.OG_STORAGE_INDEXER_TURBO;
  if (!rpcUrl || !indexerUrl) throw new Error("0G Storage endpoints are not configured");
  return { rpcUrl, indexerUrl, privateKey: readPrivateKey() };
}

function getComputeConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const providerAddress = process.env.OG_COMPUTE_PROVIDER_ADDR;
  if (!rpcUrl || !providerAddress) return null;
  return { rpcUrl, privateKey: readPrivateKey(), providerAddress };
}

function normalizeClanState(raw: any) {
  return {
    realmRootURI: raw.realmRootURI ?? String(raw[1] ?? ""),
  };
}

async function downloadRealm(rootHash: string, tokenId: string) {
  const tmpPath = join(tmpdir(), `0gclawforge-npc-realm-${tokenId}-${Date.now()}.json`);
  try {
    await downloadFromStorage(rootHash, tmpPath, getStorageConfig());
    return JSON.parse(await readFile(tmpPath, "utf8"));
  } finally {
    await rm(tmpPath, { force: true });
  }
}

export async function POST(req: NextRequest, { params }: { params: { tokenId: string } }) {
  try {
    const body = await req.json();
    const computeConfig = getComputeConfig();
    if (!computeConfig) {
      return NextResponse.json({ error: "0G Compute is not configured for live NPC dialogue." }, { status: 500 });
    }

    const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
    const address = getAgentInftAddress(Number(req.nextUrl.searchParams.get("chainId") || 16602));
    if (!rpcUrl || !address) throw new Error("Clan contract configuration is missing.");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, agentInftAbi, provider);
    const clanState = normalizeClanState(await contract.getClanState(BigInt(params.tokenId)));
    if (!clanState.realmRootURI) throw new Error("Clan has no active realm.");

    const realmRecord = await downloadRealm(clanState.realmRootURI, params.tokenId);
    const realm = realmRecord.payload;
    const npc = realm.assets.find((asset: any) => asset.type === "npc" && asset.name === body.npcName);
    if (!npc) throw new Error("NPC not found in active realm.");

    const client = new ZGComputeClient(computeConfig);
    await client.setupProvider(computeConfig.providerAddress);

    const result = await client.query(
      `You are ${npc.name} inside the realm "${realm.title}".

Realm prompt: ${realm.prompt}
Realm lore: ${realm.lore}
NPC base description: ${npc.description}
Player state summary: ${body.stateSummary || "Unknown"}
Recent interactions: ${Array.isArray(body.recentLog) ? body.recentLog.join(" | ") : "None"}

Respond as the NPC in 2-4 sentences. Give concrete guidance tied to the current realm map, quests, artifacts, boss, or player progress. End with one actionable hint.`,
      {
        systemPrompt: "You are a live NPC memory engine for a permanent 0G clan realm. Stay in character, use the supplied world state, and return plain text only.",
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
    const message = error instanceof Error ? error.message : "Unknown NPC compute error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
