import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";
import { stripHtml } from "./lib/scraper";
import { deriveCategories } from "./lib/category";

// 米哈游招聘官网（jobs.mihoyo.com）— 自研 ATS（网关 ats.openout.mihoyo.com/ats-portal）。
// 实测岗位列表接口：POST /v1/job/list，body 形如
//   { data: { recruitChannel: "social", pageIndex: 1, pageSize: 20, keyword } }
// 其中 recruitChannel 社招=social / 校招=campus。
//
// ⚠️ best-effort 实现：该接口疑似有 WAF / 请求签名校验，服务端会偶发
//    "参数校验失败:职位渠道/页码/每页条数 不能为空"（相同请求轮询报错），
//    纯服务端 fetch 不稳定。生产环境建议改走无头浏览器（Playwright）携带
//    页面 cookie / 签名后再调用。解析逻辑已做防御式处理。

const API = "https://ats.openout.mihoyo.com/ats-portal/v1/job/list";

type MhJob = {
  id?: string | number;
  positionName?: string;
  title?: string;
  departmentName?: string;
  cityName?: string;
  workCity?: string;
  jobDetail?: string;
  publishDate?: string;
};

export const mihoyoSource: JobSource = {
  id: "mihoyo",
  label: "米哈游",
  category: "game",
  async search(keyword: string): Promise<SourceJob[]> {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/json",
        clientId: "7a334db6d40ea6cc",
        Referer: "https://jobs.mihoyo.com/",
      },
      body: JSON.stringify({
        data: { recruitChannel: "social", pageIndex: 1, pageSize: 20, keyword },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`mihoyo HTTP ${res.status}`);
    const body = (await res.json()) as {
      success?: boolean;
      data?: MhJob[] | { list?: MhJob[] };
    };
    const list: MhJob[] = Array.isArray(body.data)
      ? body.data
      : ((body.data as { list?: MhJob[] } | undefined)?.list ?? []);

    return list.slice(0, 20).map((j) => {
      const title = j.positionName ?? j.title ?? "(untitled)";
      const text = `${title} ${j.departmentName ?? ""} ${j.cityName ?? j.workCity ?? ""}`;
      return {
        externalId: `mihoyo-${j.id ?? title}`,
        title,
        company: "米哈游",
        location: j.cityName ?? j.workCity,
        url: `https://jobs.mihoyo.com/social/position/${j.id ?? ""}`,
        snippet: stripHtml(j.jobDetail).slice(0, 500),
        publishedAt: j.publishDate ? new Date(j.publishDate) : undefined,
        categories: deriveCategories(text, "game"),
        raw: j,
      };
    });
  },
};
