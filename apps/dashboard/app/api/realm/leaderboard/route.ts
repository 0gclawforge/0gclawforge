import { NextRequest, NextResponse } from "next/server";
import { getDungeonLeaderboard } from "../../../../lib/dungeon-leaderboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const chainId = req.nextUrl.searchParams.get("chainId") === "16661" ? 16661 : 16602;
    const leaderboard = await getDungeonLeaderboard(chainId);
    return NextResponse.json(leaderboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown leaderboard error";
    console.error("Dungeon leaderboard GET failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
