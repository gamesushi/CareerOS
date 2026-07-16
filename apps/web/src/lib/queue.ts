import { Queue } from "bullmq";

// web 侧只入队，处理器在 apps/worker（docs/design/00 ADR-002）

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");

const globalForQueue = globalThis as unknown as { aiQueue?: Queue };

export const aiQueue =
  globalForQueue.aiQueue ??
  new Queue("ai", {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      maxRetriesPerRequest: null,
    },
  });

if (process.env.NODE_ENV !== "production") globalForQueue.aiQueue = aiQueue;
