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
  if (!privateKey) throw new Error("PRIVATE_KEY is required for clan chat compute.");
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
  const tmpPath = join(tmpdir(), `0gclawforge-chat-realm-${tokenId}-${Date.now()}.json`);
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
    const { message, stateSummary, recentLog, history } = body as {
      message: string;
      stateSummary?: string;
      recentLog?: string[];
      history?: Array<{ role: "user" | "clan"; text: string }>;
    };

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const computeConfig = getComputeConfig();
    if (!computeConfig) {
      return NextResponse.json({ error: "0G Compute is not configured for clan chat." }, { status: 500 });
    }

    const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
    const address = getAgentInftAddress(Number(req.nextUrl.searchParams.get("chainId") || 16602));
    if (!rpcUrl || !address) throw new Error("Clan contract configuration is missing.");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, agentInftAbi, provider);
    const clanState = normalizeClanState(await contract.getClanState(BigInt(params.tokenId)));

    let realmContext = "No active realm loaded.";
    if (clanState.realmRootURI) {
      try {
        const realmRecord = await downloadRealm(clanState.realmRootURI, params.tokenId);
        const realm = realmRecord.payload;
        const assetSummary = realm.assets
          .map((a: any) => `${a.type}: ${a.name}`)
          .join(", ");
        realmContext = `Realm: "${realm.title}". Lore: ${realm.lore}. Assets: ${assetSummary}.`;
      } catch {
        realmContext = "Realm data could not be loaded.";
      }
    }

    const chatHistory = (history ?? [])
      .slice(-6)
      .map((m: any) => `${m.role === "user" ? "Player" : "Clan AI"}: ${m.text}`)
      .join("\n");

    const client = new ZGComputeClient(computeConfig);
    await client.setupProvider(computeConfig.providerAddress);

    const result = await client.query(
      `${realmContext}

Player state: ${stateSummary || "Unknown"}
Recent game log: ${Array.isArray(recentLog) ? recentLog.slice(-5).join(" | ") : "None"}

${chatHistory ? `Recent chat:\n${chatHistory}\n` : ""}Player: ${message}

Respond as the Clan Advisor. Give strategic advice about the current realm, quests, combat, or exploration. Be concise (2-4 sentences). If the player asks about game mechanics, explain them. If they ask for help with the boss or quests, give actionable tips based on the realm state.`,
      {
        systemPrompt:
          "You are a Clan Advisor AI for an Eternal Clans realm game running on 0G infrastructure. You have access to the realm state and player progress. You give helpful, in-character strategic advice. Stay brief and actionable. Use plain text only.",
        temperature: 0.6,
        maxTokens: 200,
      }
    );

    return NextResponse.json({
      reply: result.text.trim(),
      verified: result.verified,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown clan chat error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
