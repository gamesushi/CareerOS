// 无头浏览器抓取基础能力（Playwright）。
// 仅用于「纯 fetch 拿不到岗位数据」的中文 SPA 招聘站：
//   米哈游 / 猎聘 / BOSS直聘 / 中国平安 / 易方达基金 / 招商银行
// 这些站的岗位由前端 JS 渲染，或列表接口带签名/反爬（WAF、滑块验证），
// 必须执行 JS、携带页面 cookie 才能拿到真实 DOM。
//
// 设计要点：
// - 默认 headless + stealth 参数（关闭 AutomationControlled、覆盖 navigator.webdriver）
// - 统一 UA / viewport / 超时，失败一律向上抛（由 watchPoll 记入 lastError）
// - withBrowser 负责启动/关闭浏览器，handler 内自由导航 + 抽取
// - 若目标站弹出验证码/拦截页，handler 应识别并返回空数组（graceful，不污染监测）

import { existsSync } from "node:fs";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { UA } from "../types";

export const HEADLESS_TIMEOUT = 45_000;

/**
 * 优先复用本机已安装的系统 Chrome（避免再下载 Playwright chromium，本机常未预装）。
 * 找不到时回退到 Playwright 自带 chromium（生产/CI 场景）。
 */
function findSystemChrome(): string | undefined {
  const candidates: string[] =
    process.platform === "darwin"
      ? ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
      : process.platform === "win32"
        ? [
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          ]
        : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/opt/google/chrome/chrome"];
  return candidates.find((p) => existsSync(p));
}

/** 启动一个带 stealth 参数的 chromium 实例。 */
export async function launchBrowser(): Promise<Browser> {
  const exe = findSystemChrome();
  return chromium.launch({
    headless: true,
    ...(exe ? { executablePath: exe } : {}),
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-sandbox",
    ],
  });
}

export type BrowserCtx = {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** 带默认超时/策略的导航助手（domcontentloaded，失败抛错） */
  goto: (url: string) => Promise<void>;
};

/**
 * 启动浏览器 → 建 context/page → 注入 stealth 脚本 → 交给 handler 自由操作 → 关闭。
 * handler 内部自行负责 waitForSelector / 等待渲染 / 抽取。
 */
export async function withBrowser<T>(
  fn: (ctx: BrowserCtx) => Promise<T>,
): Promise<T> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: UA,
      viewport: { width: 1366, height: 900 },
      ignoreHTTPSErrors: true,
      locale: "zh-CN",
    });
    const page = await context.newPage();
    // 覆盖最常见的无头检测指纹
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false });
      // @ts-expect-error 覆盖测试驱动标识
      window.chrome = { runtime: {} };
    });
    const goto = async (url: string) => {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: HEADLESS_TIMEOUT });
    };
    return await fn({ browser, context, page, goto });
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * 等待任意一个候选选择器出现（用于不同站点 DOM 差异的兜底）。
 * 全部超时则返回 null（handler 据此后返回空数组）。
 */
export async function waitForAny(
  page: Page,
  selectors: string[],
  timeout = 15_000,
): Promise<string | null> {
  try {
    const locator = page.locator(selectors.join(", "));
    await locator.first().waitFor({ state: "attached", timeout });
    return selectors[0];
  } catch {
    // 再尝试逐个，取第一个真实出现者
    for (const s of selectors) {
      try {
        await page.locator(s).first().waitFor({ state: "attached", timeout: 2_000 });
        return s;
      } catch {
        /* 继续 */
      }
    }
    return null;
  }
}

/**
 * 高阶助手：导航到目标页并在加载过程中拦截某个 JSON API 响应，解析后返回。
 * 用于「岗位数据来自 XHR/JSON 接口」的 SPA（猎聘/平安/招行等）。
 * 若超时未捕获到 API，返回 null（调用方据此返回空数组，不污染监测）。
 */
export async function withApiCapture<T>(
  url: string,
  apiPred: (url: string) => boolean,
  parse: (json: unknown) => T,
  timeout = 25_000,
): Promise<T | null> {
  return withBrowser(async ({ page, goto }) => {
    const respP = page
      .waitForResponse((r) => apiPred(r.url()), { timeout })
      .catch(() => null);
    await goto(url);
    const resp = await respP;
    if (!resp) return null;
    const json = await resp.json().catch(() => null);
    return json ? parse(json) : null;
  });
}
