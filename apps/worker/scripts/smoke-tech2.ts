import { SOURCES } from "../src/sources/index.ts";

const NEW_IDS = [
  "webflow", "disney", "cockroachlabs", "planetscale", "clickhouse",
  "peloton", "oura", "calm", "waymo", "figureai", "watershed",
  "redwoodmaterials", "udemy", "udacity", "masterclass", "kayak",
  "flexport", "newrelic", "honeycomb", "sigmacomputing", "amplitude",
  "mixpanel", "roblox",
];

let ok = 0, fail = 0;
for (const id of NEW_IDS) {
  const src = SOURCES[id];
  if (!src) { console.log(`${id} => NOT REGISTERED`); fail++; continue; }
  try {
    const jobs = await src.search("");
    console.log(`${id} => ok jobs=${jobs.length}`);
    ok++;
  } catch (e) {
    console.log(`${id} => FAIL ${(e as Error).message}`);
    fail++;
  }
}
console.log(`\nregistered=${NEW_IDS.length} ok=${ok} fail=${fail}`);
