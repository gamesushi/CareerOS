import type { Queue } from "bullmq";
import { prisma } from "@careeros/db";
import { aiQueue, watchQueue } from "@/lib/queue";

export const QUEUES: Record<string, Queue> = { ai: aiQueue, watch: watchQueue };

export type QueueHealth = { name: string; waiting: number; active: number; delayed: number; failed: number; completed: number; ok: boolean };
export type FailedJob = { id: string; name: string; failedReason: string; attemptsMade: number; timestamp: string };

async function counts(name: string, q: Queue): Promise<QueueHealth> {
  try {
    const c = await q.getJobCounts("waiting", "active", "delayed", "failed", "completed");
    return { name, waiting: c.waiting ?? 0, active: c.active ?? 0, delayed: c.delayed ?? 0, failed: c.failed ?? 0, completed: c.completed ?? 0, ok: true };
  } catch {
    return { name, waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0, ok: false };
  }
}

async function failedJobs(q: Queue): Promise<FailedJob[]> {
  try {
    const jobs = await q.getJobs(["failed"], 0, 14);
    return jobs.map((j) => ({
      id: String(j.id),
      name: j.name,
      failedReason: (j.failedReason ?? "").slice(0, 200),
      attemptsMade: j.attemptsMade,
      timestamp: new Date(j.timestamp).toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getSystemHealth() {
  const [ai, watch, aiFailed, embeddings, migrations] = await Promise.all([
    counts("ai", aiQueue),
    counts("watch", watchQueue),
    failedJobs(aiQueue),
    prisma.embedding.count().catch(() => 0),
    prisma
      .$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM careeros."_prisma_migrations" WHERE finished_at IS NOT NULL`
      .then((r) => r[0]?.count ?? 0)
      .catch(() => 0),
  ]);
  return { queues: [ai, watch], failed: aiFailed, embeddings, migrations };
}

/** 重试某队列的失败任务（最多 100 条），返回重试数量。 */
export async function retryFailed(queueName: string): Promise<number> {
  const q = QUEUES[queueName];
  if (!q) return 0;
  const jobs = await q.getJobs(["failed"], 0, 99);
  let n = 0;
  for (const j of jobs) {
    try {
      await j.retry();
      n++;
    } catch {
      /* 单个失败忽略，继续 */
    }
  }
  return n;
}
