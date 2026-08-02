import {
  openaiSource, cohereSource, perplexitySource, elevenlabsSource, characterSource, replitSource,
  runwaySource, mercorSource, fireworksSource, lambdaSource, cursorSource,
  supercellSource, ghostSource, xaiSource, stabilityaiSource, thinkingmachinesSource,
} from "../src/sources/tech";

const all = [
  openaiSource, cohereSource, perplexitySource, elevenlabsSource, characterSource, replitSource,
  runwaySource, mercorSource, fireworksSource, lambdaSource, cursorSource,
  supercellSource, ghostSource, xaiSource, stabilityaiSource, thinkingmachinesSource,
];

async function main() {
  console.log("=== 验证 16 个新来源（search 取前 20 条）===");
  let ok = 0;
  for (const s of all) {
    try {
      const jobs = await s.search("");
      const sample = jobs[0];
      const flag = jobs.length > 0 ? "OK " : "EMPTY";
      if (jobs.length > 0) ok++;
      console.log(`${flag} ${s.id.padEnd(16)} n=${String(jobs.length).padEnd(3)} | "${sample?.title?.slice(0, 40) ?? ""}" loc=${sample?.location ?? ""} pub=${sample?.publishedAt ? "Y" : "N"}`);
    } catch (e) {
      console.log(`ERR  ${s.id.padEnd(16)} ${String(e).slice(0, 70)}`);
    }
  }
  console.log(`\n通过（返回>0）: ${ok}/${all.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
