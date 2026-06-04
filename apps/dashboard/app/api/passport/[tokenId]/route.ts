import { NextRequest, NextResponse } from "next/server";
import { getAgentPassport } from "../../../../lib/agent-passport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { tokenId: string } }) {
  try {
    const chainId = req.nextUrl.searchParams.get("chainId") === "16602" ? 16602 : 16661;
    return NextResponse.json(await getAgentPassport(params.tokenId, chainId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown passport error";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
