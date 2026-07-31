import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboard,
  parseLeaderboardBy,
  parseLeaderboardLimit,
  parseRemoteFlag,
} from "@/lib/leaderboard";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  try {
    const data = await getLeaderboard({
      by: parseLeaderboardBy(sp.get("by")),
      remote: parseRemoteFlag(sp.get("remote")),
      limit: parseLeaderboardLimit(sp.get("limit")),
    });
    return NextResponse.json(data);
  } catch (e) {
    console.error("leaderboard error", e);
    return NextResponse.json(
      { error: { message: "排行榜生成失败，请稍后重试" } },
      { status: 500 },
    );
  }
}
