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

function cleanText(value: unknown, maxLength = 220) {
  let text = String(value ?? "")
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
      const extracted = parsed?.payload?.lore ?? parsed?.lore ?? parsed?.description ?? parsed?.title;
      if (typeof extracted === "string") text = extracted;
    } catch {
      const loreMatch = candidate.match(/"lore"\s*:\s*"([^"]+)"/);
      const titleMatch = candidate.match(/"title"\s*:\s*"([^"]+)"/);
      text = loreMatch?.[1] || titleMatch?.[1] || text;
    }
  }

  text = text.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trim()}...`;
}

function summarizeRealm(realm: any) {
  const title = cleanText(realm?.title, 80) || "Untitled realm";
  const lore = cleanText(realm?.lore, 220);
  const assets = Array.isArray(realm?.assets)
    ? realm.assets
        .slice(0, 8)
        .map((asset: any) => `${asset.type || "asset"}: ${cleanText(asset.name, 48)}`)
        .join(", ")
    : "none loaded";
  return `Realm "${title}"${lore ? `: ${lore}` : ""}. Assets: ${assets}.`;
}

async function downloadRealm(rootHash: string, tokenId: string, chainId: number) {
  const tmpPath = join(tmpdir(), `0gclawforge-chat-realm-${tokenId}-${Date.now()}.json`);
  try {
    await downloadFromStorage(rootHash, tmpPath, getStorageConfig(chainId));
    return JSON.parse(await readFile(tmpPath, "utf8"));
  } catch (err) {
    if (chainId !== 16602) {
      await rm(tmpPath, { force: true });
      const fbPath = join(tmpdir(), `0gclawforge-chat-realm-${tokenId}-fb-${Date.now()}.json`);
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

function fallbackReply(message: string, realmContext: string, stateSummary?: string) {
  const lower = message.toLowerCase();
  const state = cleanText(stateSummary, 160) || "current run state unavailable";
  if (/(autonomous|auto|move|npc|world)/.test(lower)) {
    return `${AUTONOMOUS_MODEL_NAME} local directive: keep watching the live run. The clan pilot will move the player avatar, talk to NPCs, clear small quests, collect artifacts, and reshape safe tiles while Compute is unavailable. State: ${state}.`;
  }
  if (/(quest|where|next|help)/.test(lower)) {
    return `Clan Advisor: Start with the nearest quest marker, collect artifacts before challenging the boss, and use NPC hints to choose a safer route. ${realmContext}`;
  }
  if (/(boss|fight|dragon|attack)/.test(lower)) {
    return "Clan Advisor: Build XP through quests and artifacts first, then fight the boss when your HP is high. If you lose, regroup at spawn and preserve gold by completing smaller objectives first.";
  }
  return `Clan Advisor: I can still guide this realm while mainnet Compute is unavailable. ${realmContext} Watch the log, speak with NPCs, gather artifacts, and let the clan autonomy reshape the map around you.`;
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

    const chainId = Number(req.nextUrl.searchParams.get("chainId") || 16602);
    const computeConfig = getComputeConfig(chainId);

    const rpcUrl = getOgRpcUrl(chainId);
    const address = getAgentInftAddress(chainId);
    if (!rpcUrl || !address) throw new Error("Clan contract configuration is missing.");

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const contract = new ethers.Contract(address, agentInftAbi, provider);
    const clanState = normalizeClanState(await contract.getClanState(BigInt(params.tokenId)));

    let realmContext = "No active realm loaded.";
    if (clanState.realmRootURI) {
      try {
        const realmRecord = await downloadRealm(clanState.realmRootURI, params.tokenId, chainId);
        const realm = realmRecord.payload;
        realmContext = summarizeRealm(realm);
      } catch {
        realmContext = "Realm data could not be loaded.";
      }
    }

    const chatHistory = (history ?? [])
      .slice(-6)
      .map((m: any) => `${m.role === "user" ? "Player" : "Clan AI"}: ${m.text}`)
      .join("\n");

    if (!computeConfig) {
      return NextResponse.json({
        reply: fallbackReply(message, realmContext, stateSummary),
        verified: false,
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
        `${realmContext}

Player state: ${stateSummary || "Unknown"}
Recent game log: ${Array.isArray(recentLog) ? recentLog.slice(-5).join(" | ") : "None"}

${chatHistory ? `Recent chat:\n${chatHistory}\n` : ""}Player: ${message}

Respond as the Clan Advisor using ${AUTONOMOUS_MODEL_NAME} sovereign-agent style. Give strategic advice about the current realm, quests, combat, exploration, or autonomous clan behavior. Be concise (2-4 sentences). If the player asks about game mechanics, explain them. If they ask for help with the boss, quests, NPCs, or autonomous mode, give actionable tips based on the realm state.`,
      {
        systemPrompt:
          `You are a Clan Advisor AI for an Eternal Clans realm game running on 0G infrastructure. Act like ${AUTONOMOUS_MODEL_NAME}: strong at agentic tool-use planning, world-state reasoning, and concise direction. You have access to the realm state and player progress. Stay brief and actionable. Use plain text only.`,
        temperature: 0.6,
        maxTokens: 1024,
      }
    );

      return NextResponse.json({
        reply: result.text.trim(),
        verified: result.verified,
      });
    } catch (error) {
      const warning = error instanceof Error ? error.message : "0G Compute request failed.";
      return NextResponse.json({
        reply: fallbackReply(message, realmContext, stateSummary),
        verified: false,
        fallback: true,
        warning,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown clan chat error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
