import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";
import { fetchHtml } from "./lib/scraper";
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

// ---- 基金 / 资管 / 量化交易（补充，实网验证 2026-07-25）----
export const schonfeldSource = makeGreenhouseSource({ id: "schonfeld", label: "Schonfeld", board: "schonfeld", category: "finance" });
export const exoduspointSource = makeGreenhouseSource({ id: "exoduspoint", label: "ExodusPoint", board: "exoduspoint", category: "finance" });

// ============================================================
// 中文金融机构官网（best-effort）
// ------------------------------------------------------------
// 平安(talent.pingan.com) / 易方达(efunds.com.cn) / 招商银行(career.cmbchina.com)
// 的招聘页均为前端 SPA（Umi/React），服务端不返回岗位数据、且有反爬，
// 纯 fetch 无法解析。与 mihoyo / 猎聘 / BOSS 一致，标记为 best-effort：
// 这里尝试抓取并在不可解析时抛出明确错误（由 watchPoll 记入 lastError）。
// 生产环境需改走无头浏览器（Playwright）携带 cookie / 执行 JS 后解析。
// ============================================================

// 中国平安 — 保险
export const pinganSource: JobSource = {
  id: "pingan",
  label: "中国平安",
  category: "finance",
  async search(): Promise<SourceJob[]> {
    const html = await fetchHtml("https://talent.pingan.com/", { headers: { "User-Agent": UA } });
    throw new Error(`pingan: 招聘页为前端 SPA（${html.length}B），无服务端岗位数据，需 headless 浏览器（Playwright）解析`);
  },
};

// 易方达基金 — 基金
export const efundSource: JobSource = {
  id: "efund",
  label: "易方达基金",
  category: "finance",
  async search(): Promise<SourceJob[]> {
    const html = await fetchHtml("https://www.efunds.com.cn/", { headers: { "User-Agent": UA } });
    throw new Error(`efund: 招聘页为前端 SPA（${html.length}B），无服务端岗位数据，需 headless 浏览器（Playwright）解析`);
  },
};

// 招商银行 — 银行
export const cmbSource: JobSource = {
  id: "cmb",
  label: "招商银行",
  category: "finance",
  async search(): Promise<SourceJob[]> {
    const html = await fetchHtml("https://career.cmbchina.com/", { headers: { "User-Agent": UA } });
    throw new Error(`cmb: 招聘页为前端 SPA（${html.length}B），无服务端岗位数据，需 headless 浏览器（Playwright）解析`);
  },
};
