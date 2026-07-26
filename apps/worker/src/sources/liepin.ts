import type { JobSource, SourceJob } from "./types";
import { deriveCategories } from "./lib/category";
import { withApiCapture } from "./lib/headless";

// 猎聘（liepin.com）搜索结果页。
// 历史：裸 fetch 常被反爬拦（400 + Robot），服务端也不稳定。
// 现方案：Playwright 加载搜索页（真实浏览器 cookie），拦截前端调用的
//   api-c.liepin.com/api/com.liepin.searchfront4c.pc-search-job
// 直接解析返回的 JSON 岗位列表（结构化、稳定）。

export const liepinSource: JobSource = {
  id: "liepin",
  label: "猎聘",
  async search(keyword: string): Promise<SourceJob[]> {
    const data = await withApiCapture<SourceJob[] | null>(
      `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(keyword)}`,
      (u) => /pc-search-job(?=\?|$)/.test(u),
      (json: any) => {
        const list: any[] = json?.data?.data?.jobCardList ?? [];
        return list.slice(0, 20).map((card) => {
          const job = card.job ?? {};
          const comp = card.comp ?? {};
          const text = `${job.title ?? ""} ${comp.compName ?? ""} ${job.dq ?? ""} ${job.salary ?? ""}`;
          const url = job.link
            ? job.link.startsWith("http")
              ? job.link
              : `https://www.liepin.com${job.link}`
            : `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(keyword)}`;
          return {
            externalId: `liepin-${job.jobId ?? job.title}`,
            title: job.title ?? "(untitled)",
            company: comp.compName,
            location: job.dq,
            salary: job.salary,
            url,
            snippet: Array.isArray(job.labels) ? job.labels.join(" ") : undefined,
            categories: deriveCategories(text),
            raw: card,
          } as SourceJob;
        });
      },
    );
    return data ?? [];
  },
};
