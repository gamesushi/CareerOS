import { handleWatchPollJob } from "../src/jobs/watchPoll";

// 手动触发一个监测任务的轮询，让新增来源流入 DiscoveredJob。
const WATCH_ID = process.argv[2];
if (!WATCH_ID) {
  console.error("usage: trigger-poll.ts <watchId>");
  process.exit(1);
}
console.log("triggering poll for", WATCH_ID);
handleWatchPollJob(WATCH_ID)
  .then((r) => console.log("poll done:", JSON.stringify(r)))
  .catch((e) => { console.error("poll error:", e); process.exit(1); });
