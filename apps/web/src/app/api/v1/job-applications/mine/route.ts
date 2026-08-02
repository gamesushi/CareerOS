// 我投过的岗与当前状态。候选端用来在岗位卡片上显示「已投递 / 面试中」徽标。

import { handler, ok, requireUser } from "@/lib/api";
import { listMyApplications } from "@/lib/job-applications";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  return ok({ data: await listMyApplications(userId) });
});
