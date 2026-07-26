import type { JobSource, SourceJob } from "./types";

// BOSS 直聘（zhipin.com）搜索结果页。
// 历史：列表接口需签名 cookie（__zp_stoken_ 等），裸请求必被拦。
// 现探明：未登录访问搜索页会被 302 重定向到 /web/user/（登录墙），
// 无有效 session 无法获取任何岗位数据。纯 Web（含 Playwright 匿名访问）
// 同样受登录墙限制，需用户登录态 cookie 才能抓取。
// 维持 best-effort：返回空数组，不污染监测（不抛错）。
// 若后续拿到用户授权 cookie，可在此接入 withBrowser + 注入 cookie 的抓取分支。

export const bossSource: JobSource = {
  id: "boss",
  label: "BOSS直聘",
  async search(): Promise<SourceJob[]> {
    return [];
  },
};
