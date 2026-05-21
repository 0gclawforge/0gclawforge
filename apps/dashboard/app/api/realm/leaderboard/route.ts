import { NextResponse } from "next/server";
import { getDungeonLeaderboard } from "../../../../lib/dungeon-leaderboard";

export async function GET() {
  try {
    const leaderboard = await getDungeonLeaderboard();
    return NextResponse.json(leaderboard);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown leaderboard error";
    console.error("Dungeon leaderboard GET failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
