// 候选端公共流：所有登录用户看到同一批已过审、在招、未下架的企业发布岗。
// 注意这与 /discovered-jobs 语义不同——那条是按 userId 隔离的私有 feed，
// 两者在前端 /jobs/active 合流展示（详见 docs/b-end-plan.md §7）。

import { handler, ok, requireUser } from "@/lib/api";
import { listPublicPostings } from "@/lib/job-postings";

export const GET = handler(async () => {
  await requireUser();
  return ok({ data: await listPublicPostings() });
});
