import {
  spotifySource,
  binanceSource,
  angellistSource,
  theAthleticSource,
  houzzSource,
} from "../src/sources/lever";

const srcs = [spotifySource, binanceSource, angellistSource, theAthleticSource, houzzSource];

async function main() {
  for (const s of srcs) {
    try {
      const jobs = await s.search("");
      const first = jobs[0];
      console.log(
        `${s.id.padEnd(12)} count=${String(jobs.length).padStart(4)}  cat=${JSON.stringify(
          first?.categories ?? [],
        )}  ex=${first?.title?.slice(0, 45) ?? "(none)"}  url?=${!!first?.url}  date?=${!!first?.publishedAt}`,
      );
    } catch (e) {
      console.log(`${s.id.padEnd(12)} ERROR ${String(e).slice(0, 80)}`);
    }
  }
}

main().then(() => process.exit(0));
