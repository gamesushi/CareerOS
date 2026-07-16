import { Worker, Queue } from "bullmq";

// Sprint 1 骨架：队列拓扑先定型，处理器 Sprint 2 起逐个填充（见 docs/design/04-ai-workflows.md）。

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null,
};

export const AI_QUEUE = "ai";
export const aiQueue = new Queue(AI_QUEUE, { connection });

type AiJobName = "resume_parse" | "jd_parse" | "resume_generate" | "profile_generate" | "worklog_summarize" | "job_match";

const worker = new Worker(
  AI_QUEUE,
  async (job) => {
    switch (job.name as AiJobName) {
      case "resume_parse":
      case "jd_parse":
      case "resume_generate":
      case "profile_generate":
      case "worklog_summarize":
      case "job_match":
        throw new Error(`handler for "${job.name}" not implemented yet (Sprint 2+)`);
      default:
        throw new Error(`unknown job: ${job.name}`);
    }
  },
  { connection, concurrency: 2 },
);

worker.on("completed", (job) => console.log(`[ai] completed ${job.name}#${job.id}`));
worker.on("failed", (job, err) => console.error(`[ai] failed ${job?.name}#${job?.id}: ${err.message}`));

console.log(`[worker] listening on queue "${AI_QUEUE}"`);
