import { Queue } from "bullmq";

// web 侧只入队，处理器在 apps/worker（docs/design/00 ADR-002）

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");

const globalForQueue = globalThis as unknown as { aiQueue?: Queue; watchQueue?: Queue };

const conn = {
  connection: {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || 6379),
    maxRetriesPerRequest: null,
  },
};

export const aiQueue = globalForQueue.aiQueue ?? new Queue("ai", conn);
export const watchQueue = globalForQueue.watchQueue ?? new Queue("watch", conn);

if (process.env.NODE_ENV !== "production") {
  globalForQueue.aiQueue = aiQueue;
  globalForQueue.watchQueue = watchQueue;
}
