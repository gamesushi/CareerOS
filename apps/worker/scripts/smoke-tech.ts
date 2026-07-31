import { SOURCES } from "../src/sources/index.ts";

const NEW_IDS = [
  "stripe", "datadog", "figma", "cloudflare", "twilio", "gitlab",
  "okta", "zscaler", "mongodb", "databricks", "fastly", "anthropic",
  "discord", "pinterest", "reddit", "twitch", "lyft", "instacart",
  "gemini", "coursera", "duolingo", "airbnb", "tripadvisor",
];

async function main() {
  let ok = 0;
  let fail = 0;
  for (const id of NEW_IDS) {
    const src = SOURCES[id];
    if (!src) {
      console.log(`${id} => MISSING (not registered)`);
      fail++;
      continue;
    }
    try {
      const jobs = await src.search("");
      console.log(`${id} => OK jobs=${jobs.length} sample="${jobs[0]?.title ?? "-"}"`);
      ok++;
    } catch (e) {
      console.log(`${id} => ERROR ${(e as Error).message}`);
      fail++;
    }
  }
  console.log(`\nregistered=${NEW_IDS.length} ok=${ok} fail=${fail}`);
}
void main();
