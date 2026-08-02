const test = async (slug: string) => {
  const targets: [string, string][] = [
    ["GH", `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`],
    ["ASHBY", `https://api.ashbyhq.com/posting-api/job-board/${slug}`],
  ];
  for (const [name, url] of targets) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(12_000) });
      const d = (await r.json().catch(() => null)) as any;
      const n = d?.jobs?.length ?? d?.data?.length ?? "n/a";
      console.log(`${name} ${slug.padEnd(16)} status=${r.status} jobs=${n}`);
    } catch (e: any) {
      console.log(`${name} ${slug.padEnd(16)} ERR ${e?.message}`);
    }
  }
};

const slugs = [
  "riotgames", "sega", "konami", "capcom", "squareenix",
  "nvidia", "intel", "amd", "huggingface", "mistral",
  "sony", "rakuten", "netflix", "snap", "unity",
];
(async () => {
  for (const s of slugs) await test(s);
  process.exit(0);
})();
