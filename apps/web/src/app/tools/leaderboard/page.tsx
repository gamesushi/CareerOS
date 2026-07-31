import type { Metadata } from "next";
import { getLeaderboard, parseLeaderboardBy, parseLeaderboardLimit, parseRemoteFlag } from "@/lib/leaderboard";
import { LeaderboardClient } from "./leaderboard-client";

export const metadata: Metadata = {
  title: "公司 / 来源招聘排行榜 · CareerOS 免费求职工具",
  description:
    "基于 CareerOS 多源岗位监测数据，按在招职位数排名的热门公司与招聘来源。免登录公开榜，实时聚合。",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ by?: string; remote?: string; limit?: string }>;
}) {
  const sp = await searchParams;
  const data = await getLeaderboard({
    by: parseLeaderboardBy(sp.by),
    remote: parseRemoteFlag(sp.remote),
    limit: parseLeaderboardLimit(sp.limit),
  });
  return (
    <LeaderboardClient
      initialBy={data.by}
      initialRemote={data.remoteOnly}
      initialData={data}
    />
  );
}
