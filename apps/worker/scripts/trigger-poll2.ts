import { handleWatchPollJob } from "../src/jobs/watchPoll.ts";

const ids = [
  "85e32199-6877-4b0e-a095-4eb7bd91f2db", // AI 岗位追踪
  "f8535f43-ff17-461b-8952-37824dbb5a05", // Bootstrap EN
];

async function main() {
  for (const id of ids) {
    console.log(`\n===== polling ${id} =====`);
    const r = await handleWatchPollJob(id);
    console.log(`done ${id}:`, JSON.stringify(r));
  }
  console.log("\nALL DONE");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
