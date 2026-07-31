import type { JobSource, SourceJob } from "./types";
import type { JobCategory } from "./lib/category";
import { withBrowser, type BrowserCtx } from "./lib/headless";

// 中文 SPA 招聘站通用适配器工厂。
// 大量中国公司（游戏厂、券商、基金）的招聘页是前端渲染，岗位来自 XHR/JSON 接口，
// 纯 fetch 拿不到（反爬/WAF/签名）。与平安/招商/米哈游同理，必须用真实无头浏览器
// 渲染并拦截前端调用的 JSON 接口。
//
// 用法：每个公司提供一段 `run(ctx)`，在浏览器上下文里把接口数据映射成 SourceJob[]。
// 站点返回空/拦截页时 `run` 应返回 []（优雅降级，不污染监测）；真实异常可向上抛，
// 由 watchPoll 记入 lastError（与 pingan/cmb 行为一致）。
//
// 工厂统一封装浏览器启停，不会吞掉 `run` 抛出的错误。

export type CnApiSource = {
  id: string;
  label: string;
  /** 来源品类亲和（如游戏厂默认 "game"），用于来源级品类匹配 */
  category?: JobCategory;
  /** 在真实浏览器上下文里抓取并映射岗位；返回空数组 = 无数据/被拦截 */
  run: (ctx: BrowserCtx) => Promise<SourceJob[]>;
};

export function makeCnApiSource(s: CnApiSource): JobSource {
  return {
    id: s.id,
    label: s.label,
    category: s.category,
    async search(): Promise<SourceJob[]> {
      return withBrowser((ctx) => s.run(ctx));
    },
  };
}

// 便捷助手：在页面已加载的前提下，等待某个响应并解析为 SourceJob[]。
// apiPred 命中接口 URL；parse 把 JSON body 映射成 SourceJob[]。
export async function captureApi(
  ctx: BrowserCtx,
  apiPred: (url: string) => boolean,
  parse: (json: any) => SourceJob[],
  timeout = 25_000,
): Promise<SourceJob[]> {
  const resp = await ctx.page
    .waitForResponse((r) => apiPred(r.url()), { timeout })
    .catch(() => null);
  if (!resp) return [];
  const json = await resp.json().catch(() => null);
  if (!json) return [];
  return parse(json);
}

// 便捷助手：在页面上下文里用 fetch POST 某接口并解析（适用于接口需 POST 的站点）。
// 先 goto 建立 cookie/上下文，再 page.evaluate 内 fetch。
export async function postApi(
  ctx: BrowserCtx,
  apiUrl: string,
  body: Record<string, unknown>,
  parse: (json: any) => SourceJob[],
): Promise<SourceJob[]> {
  const json = await ctx.page
    .evaluate(
      async ({ apiUrl, body }) => {
        const r = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return r.json().catch(() => null);
      },
      { apiUrl, body },
    )
    .catch(() => null);
  if (!json) return [];
  return parse(json);
}
