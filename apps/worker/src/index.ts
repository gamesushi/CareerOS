import { Worker, Queue } from "bullmq";
import { handleResumeParseJob } from "./jobs/resumeParse";
import { handleJdParseJob } from "./jobs/jdParse";
import { handleJobMatchJob } from "./jobs/jobMatch";
import { handleWorklogSummarizeJob } from "./jobs/worklogSummarize";
import { handleProfileGenerateJob } from "./jobs/profileGenerate";
import { handleResumeGenerateJob } from "./jobs/resumeGenerate";
import { handleWatchPollJob } from "./jobs/watchPoll";
import { handleCostAlertJob } from "./jobs/costAlertCheck";
import { handleScoreDiscoveredJob } from "./jobs/scoreDiscovered";

// AI 任务 worker：队列拓扑见 docs/design/04-ai-workflows.md §5
// 并发 2、超时由各步骤自身控制（docreader 120s、LLM 110s）
// watch 队列：岗位监测轮询（repeatable 每 5 分钟扫到期任务 + 手动触发）

const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null,
};

export const AI_QUEUE = "ai";
export const WATCH_QUEUE = "watch";

type AiJobName = "resume_parse" | "jd_parse" | "resume_generate" | "profile_generate" | "worklog_summarize" | "job_match" | "score_discovered";

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
        return handleResumeGenerateJob(job.data.resumeId as string);
      case "score_discovered":
        return handleScoreDiscoveredJob(job.data.userId as string);
      default:
        throw new Error(`unknown job: ${job.name}`);
    }
  },
  { connection, concurrency: 2 },
);

worker.on("completed", (job) => console.log(`[ai] completed ${job.name}#${job.id}`));
worker.on("failed", (job, err) => console.error(`[ai] failed ${job?.name}#${job?.id}: ${err.message}`));

const watchWorker = new Worker(
  WATCH_QUEUE,
  async (job) => {
    if (job.name === "cost_alert_check") return handleCostAlertJob();
    return handleWatchPollJob(job.data?.watchId as string | undefined);
  },
  { connection, concurrency: 1 },
);

watchWorker.on("completed", (job, result) => {
  const r = result as { scanned: number; found: number };
  if (r.scanned > 0) console.log(`[watch] ${job.name}#${job.id} scanned=${r.scanned} found=${r.found}`);
});
watchWorker.on("failed", (job, err) => console.error(`[watch] failed ${job?.name}#${job?.id}: ${err.message}`));

// 注册 repeatable 调度（幂等：同 jobId 重复 upsert 无副作用）
const watchQueue = new Queue(WATCH_QUEUE, { connection });
void watchQueue
  .upsertJobScheduler("watch-poll-scheduler", { every: 5 * 60_000 }, { name: "watch_poll", data: {} })
  .then(() => console.log("[watch] scheduler armed (every 5min)"));

// 成本告警：每小时检查一次当日 AI 成本是否超阈值（当日只通知一次，见 runCostAlertCheck）
void watchQueue
  .upsertJobScheduler("cost-alert-scheduler", { every: 60 * 60_000 }, { name: "cost_alert_check", data: {} })
  .then(() => console.log("[alert] cost-alert scheduler armed (hourly)"));

console.log(`[worker] listening on queues "${AI_QUEUE}", "${WATCH_QUEUE}" (redis ${redisUrl.host})`);
