import { handler, ok, requireUser } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

// 触发对当前用户「未评分」发现岗位的评分（worker 侧 score_discovered）。
// 用于给存量岗位补分，或用户手动重算；返回 202 语义，前端稍后刷新。
export const POST = handler(async () => {
  const { userId } = await requireUser();
  await aiQueue.add("score_discovered", { userId }, { removeOnComplete: true, removeOnFail: 100 });
  return ok({ enqueued: true });
});
