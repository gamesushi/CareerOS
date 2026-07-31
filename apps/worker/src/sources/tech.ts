import { makeGreenhouseSource } from "./greenhouse";

// 美国科技 / AI / 社交 / 出行 / 电商 / 教育 / 旅游 / 加密行业来源。
// 全部为 Greenhouse（greenhouse.io）官方招聘板，公开 JSON 接口、无需鉴权。
// 实网验证 2026-07-27：均返回真实岗位（stripe 536 / datadog 418 / anthropic 418 /
// databricks 800 / okta 352 / zscaler 305 / mongodb 401 等）。
// 新增同类来源：复制一行 makeGreenhouseSource 即可，board token 即公司标识。

export const stripeSource = makeGreenhouseSource({ id: "stripe", label: "Stripe", board: "stripe", category: "tech" });
export const datadogSource = makeGreenhouseSource({ id: "datadog", label: "Datadog", board: "datadog", category: "tech" });
export const figmaSource = makeGreenhouseSource({ id: "figma", label: "Figma", board: "figma", category: "tech" });
export const cloudflareSource = makeGreenhouseSource({ id: "cloudflare", label: "Cloudflare", board: "cloudflare", category: "tech" });
export const twilioSource = makeGreenhouseSource({ id: "twilio", label: "Twilio", board: "twilio", category: "tech" });
export const gitlabSource = makeGreenhouseSource({ id: "gitlab", label: "GitLab", board: "gitlab", category: "tech" });
export const oktaSource = makeGreenhouseSource({ id: "okta", label: "Okta", board: "okta", category: "tech" });
export const zscalerSource = makeGreenhouseSource({ id: "zscaler", label: "Zscaler", board: "zscaler", category: "tech" });
export const mongodbSource = makeGreenhouseSource({ id: "mongodb", label: "MongoDB", board: "mongodb", category: "tech" });
export const databricksSource = makeGreenhouseSource({ id: "databricks", label: "Databricks", board: "databricks", category: "ai" });
export const fastlySource = makeGreenhouseSource({ id: "fastly", label: "Fastly", board: "fastly", category: "tech" });
export const anthropicSource = makeGreenhouseSource({ id: "anthropic", label: "Anthropic", board: "anthropic", category: "ai" });
export const discordSource = makeGreenhouseSource({ id: "discord", label: "Discord", board: "discord", category: "tech" });
export const pinterestSource = makeGreenhouseSource({ id: "pinterest", label: "Pinterest", board: "pinterest", category: "tech" });
export const redditSource = makeGreenhouseSource({ id: "reddit", label: "Reddit", board: "reddit", category: "tech" });
export const twitchSource = makeGreenhouseSource({ id: "twitch", label: "Twitch", board: "twitch", category: "tech" });
export const lyftSource = makeGreenhouseSource({ id: "lyft", label: "Lyft", board: "lyft", category: "tech" });
export const instacartSource = makeGreenhouseSource({ id: "instacart", label: "Instacart", board: "instacart", category: "tech" });
export const geminiSource = makeGreenhouseSource({ id: "gemini", label: "Gemini", board: "gemini", category: "tech" });
export const courseraSource = makeGreenhouseSource({ id: "coursera", label: "Coursera", board: "coursera", category: "tech" });
export const duolingoSource = makeGreenhouseSource({ id: "duolingo", label: "Duolingo", board: "duolingo", category: "tech" });
export const airbnbSource = makeGreenhouseSource({ id: "airbnb", label: "Airbnb", board: "airbnb", category: "tech" });
export const tripadvisorSource = makeGreenhouseSource({ id: "tripadvisor", label: "Tripadvisor", board: "tripadvisor", category: "tech" });

// 第二轮扩充：设计 / 媒体 / 数据库 / 健康 / 气候 / 教育 / 旅游 / 物流 / 数据分析 / 游戏（实网验证 2026-07-27）
export const webflowSource = makeGreenhouseSource({ id: "webflow", label: "Webflow", board: "webflow", category: "tech" });
export const disneySource = makeGreenhouseSource({ id: "disney", label: "Disney", board: "disney", category: "tech" });
export const cockroachlabsSource = makeGreenhouseSource({ id: "cockroachlabs", label: "Cockroach Labs", board: "cockroachlabs", category: "tech" });
export const planetscaleSource = makeGreenhouseSource({ id: "planetscale", label: "PlanetScale", board: "planetscale", category: "tech" });
export const clickhouseSource = makeGreenhouseSource({ id: "clickhouse", label: "ClickHouse", board: "clickhouse", category: "tech" });
export const pelotonSource = makeGreenhouseSource({ id: "peloton", label: "Peloton", board: "peloton", category: "tech" });
export const ouraSource = makeGreenhouseSource({ id: "oura", label: "Oura", board: "oura", category: "tech" });
export const calmSource = makeGreenhouseSource({ id: "calm", label: "Calm", board: "calm", category: "tech" });
export const waymoSource = makeGreenhouseSource({ id: "waymo", label: "Waymo", board: "waymo", category: "ai" });
export const figureaiSource = makeGreenhouseSource({ id: "figureai", label: "Figure", board: "figureai", category: "ai" });
export const watershedSource = makeGreenhouseSource({ id: "watershed", label: "Watershed", board: "watershed", category: "tech" });
export const redwoodmaterialsSource = makeGreenhouseSource({ id: "redwoodmaterials", label: "Redwood Materials", board: "redwoodmaterials", category: "tech" });
export const udemySource = makeGreenhouseSource({ id: "udemy", label: "Udemy", board: "udemy", category: "tech" });
export const udacitySource = makeGreenhouseSource({ id: "udacity", label: "Udacity", board: "udacity", category: "tech" });
export const masterclassSource = makeGreenhouseSource({ id: "masterclass", label: "MasterClass", board: "masterclass", category: "tech" });
export const kayakSource = makeGreenhouseSource({ id: "kayak", label: "Kayak", board: "kayak", category: "tech" });
export const flexportSource = makeGreenhouseSource({ id: "flexport", label: "Flexport", board: "flexport", category: "tech" });
export const newrelicSource = makeGreenhouseSource({ id: "newrelic", label: "New Relic", board: "newrelic", category: "tech" });
export const honeycombSource = makeGreenhouseSource({ id: "honeycomb", label: "Honeycomb", board: "honeycomb", category: "tech" });
export const sigmacomputingSource = makeGreenhouseSource({ id: "sigmacomputing", label: "Sigma Computing", board: "sigmacomputing", category: "tech" });
export const amplitudeSource = makeGreenhouseSource({ id: "amplitude", label: "Amplitude", board: "amplitude", category: "tech" });
export const mixpanelSource = makeGreenhouseSource({ id: "mixpanel", label: "Mixpanel", board: "mixpanel", category: "tech" });
export const robloxSource = makeGreenhouseSource({ id: "roblox", label: "Roblox", board: "roblox", category: "game" });
