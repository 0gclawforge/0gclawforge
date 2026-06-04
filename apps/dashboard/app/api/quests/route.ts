import { NextRequest, NextResponse } from "next/server";
import {
  claimExternalQuest,
  confirmExternalQuestCompletion,
  createExternalQuest,
  listExternalQuests,
  prepareExternalQuestCompletion,
} from "../../../lib/external-quests";

function readChainId(value: unknown) {
  const chainId = Number(value || 16661);
  if (chainId !== 16602 && chainId !== 16661) throw new Error("chainId must be 16602 or 16661");
  return chainId;
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown external quest API error";
  const forbidden = /only the current|does not match|sender is not/i.test(message);
  console.error("External quest API failed", error);
  return NextResponse.json({ error: message }, { status: forbidden ? 403 : 400 });
}

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await listExternalQuests(readChainId(req.nextUrl.searchParams.get("chainId"))));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const chainId = readChainId(body.chainId);

    switch (body.action) {
      case "create":
        return NextResponse.json(await createExternalQuest({ ...body, chainId }));
      case "claim":
        return NextResponse.json(await claimExternalQuest({ ...body, chainId }));
      case "prepareCompletion":
        return NextResponse.json(await prepareExternalQuestCompletion({ ...body, chainId }));
      case "confirmCompletion":
        return NextResponse.json(await confirmExternalQuestCompletion(chainId, body.questId, body.anchorTxHash));
      default:
        return NextResponse.json({ error: "Unsupported external quest action" }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
