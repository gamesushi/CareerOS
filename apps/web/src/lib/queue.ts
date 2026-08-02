import { Queue } from "bullmq";

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
