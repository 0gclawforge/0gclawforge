import { NextRequest, NextResponse } from "next/server";
import { getDungeonLeaderboard } from "../../../../lib/dungeon-leaderboard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const chainId = req.nextUrl.searchParams.get("chainId") === "16602" ? 16602 : 16661;
    const mode = req.nextUrl.searchParams.get("mode") === "tournament" ? "tournament" : "general";
    const leaderboard = await getDungeonLeaderboard(chainId, { mode });
    return NextResponse.json(leaderboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown leaderboard error";
    console.error("Dungeon leaderboard GET failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
