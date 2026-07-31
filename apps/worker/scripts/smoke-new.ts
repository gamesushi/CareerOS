import { SOURCES } from "../src/sources/index";

async function main() {
  for (const id of ["virtu", "bandainamco"]) {
    const s = SOURCES[id];
    if (!s) {
      console.log(id, "=> NOT REGISTERED");
      continue;
    }
    try {
      const jobs = await s.search("");
      console.log(`${id} (${s.label}) => jobs=${jobs.length}`);
      if (jobs[0]) console.log("   sample:", jobs[0].title, "|", jobs[0].company, "|", jobs[0].url);
    } catch (e) {
      console.log(`${id} => ERROR:`, (e as Error).message?.slice(0, 160));
    }
  }
}
void main();
