import { NextRequest, NextResponse } from "next/server";
import { getRuntimeManager, WeatherXMClient, type ClanRuntimeDeployment } from "@0gclawforge/agents";

export const runtime = "nodejs";

interface AutonomyRequestBody {
  action: "deploy" | "status" | "runQuest" | "depin" | "stop";
  clanName?: string;
  tokenId?: string;
  proposal?: string;
  realmPrompt?: string;
  depinQuery?: string;
  memoryRootHash?: string | null;
  telegramChatId?: string;
  discordGuildId?: string;
  discordChannelId?: string;
}

function readPrivateKey(): string {
  const privateKey = process.env.PRIVATE_KEY?.trim();
  if (!privateKey) {
    throw new Error("PRIVATE_KEY is required for runtime storage and compute access.");
  }
  return privateKey.split(/\s+/)[0];
}

function getComputeConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const providerAddress = process.env.OG_COMPUTE_PROVIDER_ADDR;
  const privateKey = readPrivateKey();

  if (!rpcUrl || !providerAddress) {
    throw new Error("0G Compute is not configured. Set RPC URL and OG_COMPUTE_PROVIDER_ADDR.");
  }

  return {
    rpcUrl,
    privateKey,
    providerAddress,
  };
}

function getStorageConfig() {
  const rpcUrl = process.env.VITE_RPC_URL || process.env.NEXT_PUBLIC_OG_RPC_URL;
  const indexerUrl =
    process.env.VITE_STORAGE_INDEXER ||
    process.env.NEXT_PUBLIC_STORAGE_INDEXER ||
    process.env.OG_STORAGE_INDEXER_TURBO;

  if (!rpcUrl || !indexerUrl) {
    throw new Error("0G Storage is not configured. Set RPC URL and storage indexer.");
  }

  return {
    rpcUrl,
    indexerUrl,
    privateKey: readPrivateKey(),
  };
}

function getRuntimeManagerInstance() {
  return getRuntimeManager(getComputeConfig(), getStorageConfig());
}

function buildDeployment(body: AutonomyRequestBody): ClanRuntimeDeployment {
  if (!body.clanName || !body.tokenId || !body.proposal || !body.realmPrompt) {
    throw new Error("clanName, tokenId, proposal, and realmPrompt are required.");
  }

  const telegramToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const discordToken = process.env.DISCORD_BOT_TOKEN?.trim();
  const discordApplicationId = process.env.DISCORD_APPLICATION_ID?.trim();

  return {
    clanName: body.clanName,
    tokenId: body.tokenId,
    proposal: body.proposal,
    realmPrompt: body.realmPrompt,
    depinQuery: body.depinQuery?.trim() || process.env.WEATHERXM_DEFAULT_QUERY || "athens",
    memoryRootHash: body.memoryRootHash ?? null,
    telegram: telegramToken
      ? {
          token: telegramToken,
          clanName: body.clanName,
          chatId: body.telegramChatId?.trim() || process.env.TELEGRAM_DEFAULT_CHAT_ID?.trim(),
        }
      : undefined,
    discord:
      discordToken && discordApplicationId
        ? {
            token: discordToken,
            applicationId: discordApplicationId,
            clanName: body.clanName,
            guildId: body.discordGuildId?.trim() || process.env.DISCORD_GUILD_ID?.trim(),
            channelId: body.discordChannelId?.trim() || process.env.DISCORD_DEFAULT_CHANNEL_ID?.trim(),
          }
        : undefined,
  };
}

function integrationSummary(body: AutonomyRequestBody) {
  return {
    telegramConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    telegramChatBound: Boolean(body.telegramChatId?.trim() || process.env.TELEGRAM_DEFAULT_CHAT_ID?.trim()),
    discordConfigured: Boolean(process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_APPLICATION_ID),
    discordGuildBound: Boolean(body.discordGuildId?.trim() || process.env.DISCORD_GUILD_ID?.trim()),
    discordChannelBound: Boolean(body.discordChannelId?.trim() || process.env.DISCORD_DEFAULT_CHANNEL_ID?.trim()),
    depinBaseUrl: process.env.WEATHERXM_API_BASE || "https://api.weatherxm.com",
  };
}

export async function GET() {
  try {
    const status = getRuntimeManagerInstance().getStatus();
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown autonomy status error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AutonomyRequestBody;
    const runtimeManager = getRuntimeManagerInstance();

    if (body.action === "status") {
      return NextResponse.json(runtimeManager.getStatus());
    }

    if (body.action === "depin") {
      const depin = new WeatherXMClient(process.env.WEATHERXM_API_BASE || "https://api.weatherxm.com");
      const summary = await depin.summarize(body.depinQuery?.trim() || process.env.WEATHERXM_DEFAULT_QUERY || "athens");
      return NextResponse.json({ summary, integration: integrationSummary(body) });
    }

    if (body.action === "stop") {
      runtimeManager.stop();
      return NextResponse.json({ stopped: true, status: runtimeManager.getStatus() });
    }

    if (body.action === "deploy") {
      const status = await runtimeManager.deploy(buildDeployment(body));
      return NextResponse.json({
        status,
        integration: integrationSummary(body),
      });
    }

    if (body.action === "runQuest") {
      const status = await runtimeManager.runAutonomousCycle();
      return NextResponse.json({
        status,
        integration: integrationSummary(body),
      });
    }

    return NextResponse.json({ error: "Unsupported autonomy action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown autonomy API error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
