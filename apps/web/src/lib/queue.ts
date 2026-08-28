import { Queue, QueueEvents } from "bullmq";

// web 侧只入队，处理器在 apps/worker（docs/design/00 ADR-002）

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");

const globalForQueue = globalThis as unknown as {
  aiQueue?: Queue;
  watchQueue?: Queue;
  notifyQueue?: Queue;
};

const conn = {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    maxRetriesPerRequest: null,
  },
};

export const aiQueue = globalForQueue.aiQueue ?? new Queue("ai", conn);
export const watchQueue = globalForQueue.watchQueue ?? new Queue("watch", conn);
// 通知队列：邮件发送走 worker，失败自动重试；请求路径上只入队，不等 SMTP。
export const notifyQueue = globalForQueue.notifyQueue ?? new Queue("notify", conn);

if (process.env.NODE_ENV !== "production") {
  globalForQueue.aiQueue = aiQueue;
  globalForQueue.watchQueue = watchQueue;
  globalForQueue.notifyQueue = notifyQueue;
}

/**
 * 阻塞等待某条 ai 队列任务完成并取回其返回值（worker 在独立进程/BullMQ 消费）。
 * 用于 import-url 等需要「同步」拿到 worker 处理结果的接口（如 Workday 无头抓取）。
 * 超时或任务失败时 reject（调用方据此转成友好错误）。
 */
export async function awaitJobResult(jobId: string, timeoutMs = 75_000): Promise<unknown> {
  const qe = new QueueEvents("ai", conn);
  await qe.waitUntilReady();
  try {
    const job = await aiQueue.getJob(jobId);
    if (!job) throw new Error("job_not_found");
    const resultP = job.waitUntilFinished(qe);
    const timeoutP = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("job_timeout")), timeoutMs),
    );
    return await Promise.race([resultP, timeoutP]);
  } finally {
    await qe.close().catch(() => {});
  }
}

/**
 * 入队一条投递通知。**故意吞掉异常**：Redis 挂了不该让投递本身失败——
 * 少一封提醒邮件可以接受，丢一条投递不行。
 */
export function enqueueNotify(
  kind: "application_submitted" | "application_status_changed",
  applicationId: string,
) {
  return notifyQueue
    .add(
      kind,
      { applicationId },
      { attempts: 3, backoff: { type: "exponential", delay: 30_000 }, removeOnComplete: 100 },
    )
    .catch((e) => console.error("[notify] 入队失败:", e));
}
