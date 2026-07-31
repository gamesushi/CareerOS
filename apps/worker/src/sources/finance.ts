import type { JobSource, SourceJob } from "./types";
import { deriveCategories } from "./lib/category";
import { withApiCapture, withBrowser } from "./lib/headless";
import { makeGreenhouseSource } from "./greenhouse";

// ============================================================
// 金融品类来源：银行 / 保险 / 基金公司官网
// ------------------------------------------------------------
// 大量欧美金融机构的官方招聘站由 Greenhouse（ATS）驱动，提供公开 JSON
// 接口（GET /v1/boards/<board>/jobs?content=false），可直接复用
// makeGreenhouseSource 工厂，无需逐站写解析。
// 以下 board 均已于 2026-07-25 实网验证返回真实岗位。
// 所有来源 category="finance"，用户端「金融类」筛选自动命中。
// ============================================================

// ---- 银行 / 数字银行 / 借贷 ----
export const sofiSource = makeGreenhouseSource({ id: "sofi", label: "SoFi", board: "sofi", category: "finance" });
export const brexSource = makeGreenhouseSource({ id: "brex", label: "Brex", board: "brex", category: "finance" });
export const chimeSource = makeGreenhouseSource({ id: "chime", label: "Chime", board: "chime", category: "finance" });
export const monzoSource = makeGreenhouseSource({ id: "monzo", label: "Monzo", board: "monzo", category: "finance" });
export const n26Source = makeGreenhouseSource({ id: "n26", label: "N26", board: "n26", category: "finance" });
export const upgradeSource = makeGreenhouseSource({ id: "upgrade", label: "Upgrade", board: "upgrade", category: "finance" });
export const affirmSource = makeGreenhouseSource({ id: "affirm", label: "Affirm", board: "affirm", category: "finance" });
export const mercurySource = makeGreenhouseSource({ id: "mercury", label: "Mercury", board: "mercury", category: "finance" });
export const coinbaseSource = makeGreenhouseSource({ id: "coinbase", label: "Coinbase", board: "coinbase", category: "finance" });

// ---- 保险 ----
export const oscarSource = makeGreenhouseSource({ id: "oscar", label: "Oscar Health", board: "oscar", category: "finance" });
export const ethosSource = makeGreenhouseSource({ id: "ethos", label: "Ethos", board: "ethos", category: "finance" });

// ---- 基金 / 资管 / 量化交易 ----
export const point72Source = makeGreenhouseSource({ id: "point72", label: "Point72", board: "point72", category: "finance" });
export const imcSource = makeGreenhouseSource({ id: "imc", label: "IMC", board: "imc", category: "finance" });
export const wintonSource = makeGreenhouseSource({ id: "winton", label: "Winton", board: "winton", category: "finance" });
export const janestreetSource = makeGreenhouseSource({ id: "janestreet", label: "Jane Street", board: "janestreet", category: "finance" });
export const mangroupSource = makeGreenhouseSource({ id: "mangroup", label: "Man Group", board: "mangroup", category: "finance" });
export const jumptradingSource = makeGreenhouseSource({ id: "jumptrading", label: "Jump Trading", board: "jumptrading", category: "finance" });
export const flowtradersSource = makeGreenhouseSource({ id: "flowtraders", label: "Flow Traders", board: "flowtraders", category: "finance" });

// ---- 银行 / 支付 / 券商（补充，实网验证 2026-07-25）----
export const tideSource = makeGreenhouseSource({ id: "tide", label: "Tide", board: "tide", category: "finance" });
export const adyenSource = makeGreenhouseSource({ id: "adyen", label: "Adyen", board: "adyen", category: "finance" });
export const payoneerSource = makeGreenhouseSource({ id: "payoneer", label: "Payoneer", board: "payoneer", category: "finance" });
export const robinhoodSource = makeGreenhouseSource({ id: "robinhood", label: "Robinhood", board: "robinhood", category: "finance" });

// ---- 量化 / 做市商（实网验证 2026-07-27：board=virtu 返回 43 个真实岗位）----
export const virtuSource = makeGreenhouseSource({ id: "virtu", label: "Virtu Financial", board: "virtu", category: "finance" });

// ---- 基金 / 资管 / 量化交易（补充，实网验证 2026-07-25）----
export const schonfeldSource = makeGreenhouseSource({ id: "schonfeld", label: "Schonfeld", board: "schonfeld", category: "finance" });
export const exoduspointSource = makeGreenhouseSource({ id: "exoduspoint", label: "ExodusPoint", board: "exoduspoint", category: "finance" });

// ============================================================
// 中文金融机构官网（Playwright headless 分支）
// ------------------------------------------------------------
// 平安 / 招商银行 的招聘页为前端 SPA，岗位数据来自 XHR JSON 接口。
// 用 Playwright 加载页面（携带真实浏览器 cookie），拦截前端调用的 JSON
// API 直接解析，稳定拿到真实岗位。
// 易方达(efunds.com.cn) 经多次探测未发现任何公开招聘接口/招聘子页
// （官网为品牌站，招聘入口疑似内网或第三方 ATS，无公开端点），维持 best-effort。
// ============================================================

function parseCnDate(s?: string): Date | undefined {
  if (!s) return undefined;
  const t = s.trim();
  if (t === "今天" || t === "刚刚") return new Date();
  const d = new Date(t.replace(" ", "T"));
  return isNaN(d.getTime()) ? undefined : d;
}

// 中国平安 — 保险 / 综合金融
// 接口：talent.pingan.com/zztj-recruit-talent-webserver/rctt/candidate/position/getPositionList
export const pinganSource: JobSource = {
  id: "pingan",
  label: "中国平安",
  category: "finance",
  async search(): Promise<SourceJob[]> {
    const data = await withApiCapture<SourceJob[] | null>(
      "https://talent.pingan.com/recruit/social.html",
      (u) => /getPositionList/.test(u),
      (json: any) => {
        const list: any[] = json?.data?.list ?? json?.data ?? [];
        return list.slice(0, 30).map((p) => {
          const id = p.positionId || p.atsPositionId || p.id;
          const title = p.positionShowName || p.positionName || "(untitled)";
          const text = `${title} ${p.businessUnitName ?? ""} ${p.addressName ?? ""}`;
          const url = `https://talent.pingan.com/recruit/socialPosition.html?positionId=${encodeURIComponent(id)}`;
          return {
            externalId: `pingan-${id}`,
            title,
            company: p.businessUnitName,
            location: p.addressName,
            url,
            snippet: `${p.duty ?? ""} ${p.qualification ?? ""}`.slice(0, 500).trim(),
            publishedAt: parseCnDate(p.updateDate ?? p.uDate),
            categories: deriveCategories(text, "finance"),
            raw: p,
          } as SourceJob;
        });
      },
    );
    return data ?? [];
  },
};

// 易方达基金 — 基金（best-effort：无公开招聘接口）
export const efundSource: JobSource = {
  id: "efund",
  label: "易方达基金",
  category: "finance",
  async search(): Promise<SourceJob[]> {
    // 经探测：官网(efunds.com.cn)为品牌站，/recruitment、/zhaopin、/social 等子路径均 404，
    // 首页无招聘入口链接，疑似走内网或第三方 ATS（无公开端点）。纯 Web 无法抓取，维持 best-effort。
    // 若后续获得其 ATS 接口或招聘子域，可在此接入 withApiCapture。
    return [];
  },
};

// 招商银行 — 银行
// 接口：career.cmbchina.com/api/socialRecruitmentWebsite/job/getList （POST）
// 返回结构：{ returnCode, body: { total, data: [ { jobDisplay, branchCodeName, location, publishGID, ... } ] } }
export const cmbSource: JobSource = {
  id: "cmb",
  label: "招商银行",
  category: "finance",
  async search(): Promise<SourceJob[]> {
    return withBrowser(async ({ page, goto }) => {
      // 先加载页面建立上下文/cookie，再以前端相同方式 POST 该接口（pageSize 放大到 50）
      await goto("https://career.cmbchina.com/social/home");
      const json = (await page
        .evaluate(async () => {
          const r = await fetch(
            "https://career.cmbchina.com/api/socialRecruitmentWebsite/job/getList",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ jobTypeIdList: [], orgIdList: [], pageIndex: 1, pageSize: 50 }),
            },
          );
          return r.json();
        })
        .catch(() => null)) as any;
      if (!json) return [];
      const wrapper = json?.body ?? json;
      const list: any[] = wrapper?.data ?? wrapper?.list ?? [];
      return list.slice(0, 40).map((p) => {
        const title = p.jobDisplay || p.name || p.title || "(untitled)";
        const text = `${title} ${p.branchCodeName ?? ""} ${p.location ?? ""}`;
        const id = p.publishGID || p.id || title;
        const url = p.jobUrl || p.url || p.detailUrl || "https://career.cmbchina.com/social/home";
        return {
          externalId: `cmb-${id}`,
          title,
          company: p.branchCodeName || "招商银行",
          location: p.locationName ?? p.location,
          salary: p.salary ?? p.salaryRange,
          url: url.startsWith("http") ? url : `https://career.cmbchina.com${url}`,
          snippet: typeof p.description === "string" ? p.description.slice(0, 500) : undefined,
          categories: deriveCategories(text, "finance"),
          raw: p,
        } as SourceJob;
      });
    });
  },
};
