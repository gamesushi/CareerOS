import { Worker } from "bullmq";
import { handleResumeParseJob } from "./jobs/resumeParse";
import { handleJdParseJob } from "./jobs/jdParse";
import { handleJobMatchJob } from "./jobs/jobMatch";
import { handleWorklogSummarizeJob } from "./jobs/worklogSummarize";
import { handleProfileGenerateJob } from "./jobs/profileGenerate";

// AI 任务 worker：队列拓扑见 docs/design/04-ai-workflows.md §5
// 并发 2、超时由各步骤自身控制（docreader 120s、LLM 110s）

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null,
};

export const AI_QUEUE = "ai";

type AiJobName = "resume_parse" | "jd_parse" | "resume_generate" | "profile_generate" | "worklog_summarize" | "job_match";

const worker = new Worker(
  AI_QUEUE,
  async (job) => {
    switch (job.name as AiJobName) {
      case "resume_parse":
        return handleResumeParseJob(job.data.importId as string);
      case "jd_parse":
        return handleJdParseJob(job.data.jdId as string);
      case "job_match":
        return handleJobMatchJob(job.data.matchId as string);
      case "worklog_summarize":
        return handleWorklogSummarizeJob(job.data.workLogId as string);
      case "profile_generate":
        return handleProfileGenerateJob(job.data.userId as string);
      case "resume_generate":
        throw new Error(`handler for "${job.name}" not implemented yet (Sprint 4)`);
      default:
        throw new Error(`unknown job: ${job.name}`);
    }
  },
  { connection, concurrency: 2 },
);

worker.on("completed", (job) => console.log(`[ai] completed ${job.name}#${job.id}`));
worker.on("failed", (job, err) => console.error(`[ai] failed ${job?.name}#${job?.id}: ${err.message}`));

console.log(`[worker] listening on queue "${AI_QUEUE}" (redis ${redisUrl.host})`);
