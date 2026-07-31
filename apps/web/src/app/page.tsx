import type { Metadata } from "next";
import Link from "next/link";
import { getPublicStats } from "@/lib/stats";
import { StatsCounter } from "@/app/welcome/stats-counter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "CareerOS · 职业知识库驱动的求职操作系统",
  description:
    "CareerOS 聚合中国、美国、日本的招聘源，用 AI 帮你匹配岗位、识别诈骗、生成多地区简历，并把所有洞察沉淀为可累积的职业知识库。",
};

// 公开展示页：统计数字每小时重新聚合一次（ISR），兼顾"最新"与数据库压力。
export const revalidate = 3600;

const FEATURES = [
  {
    title: "多源岗位雷达",
    desc: "聚合 15+ 连接器、覆盖中 / 美 / 日 100+ 个招聘源，自动去重发现在招岗位。",
    tags: ["CN", "US", "JP"],
    href: "/tools/leaderboard",
  },
  {
    title: "简历 ↔ JD 匹配器",
    desc: "纯前端、零上传。实时高亮命中与缺失关键词，给出匹配度分级。",
    tags: ["免费工具"],
    href: "/tools/matcher",
  },
  {
    title: "幽灵岗 / 诈骗检测",
    desc: "粘贴招聘文案，AI 识别入职押金、培训贷、刷单垫付等红旗并给出风险等级。",
    tags: ["免费工具"],
    href: "/tools/scam-checker",
  },
  {
    title: "公司 / 来源排行榜",
    desc: "按在招职位数排名的公开榜单，快速看清哪些公司、哪些渠道在大量招人。",
    tags: ["免费工具"],
    href: "/tools/leaderboard",
  },
  {
    title: "多地区简历",
    desc: "一套职业档案，自动产出中文、英文（含签证标注）、日文（履歴書 + 職務経歴書）多版本。",
    tags: ["差异化"],
    href: "#regions",
  },
  {
    title: "可累积职业知识库",
    desc: "岗位、匹配、反馈不断沉淀，越用越懂你——而不是又一个孤立的求职 CRM。",
    tags: ["护城河"],
    href: "#",
  },
] as const;

const REGIONS = [
  {
    flag: "🇨🇳",
    name: "中国",
    points: [
      "中文简历为主，关注期望城市与薪资区间",
      "主流源：腾讯、字节、猎聘、Boss 等",
      "诈骗红旗按本地语境重定义（如入职押金 / 培训贷）",
    ],
  },
  {
    flag: "🇺🇸",
    name: "美国",
    points: [
      "英文简历，必须说明签证状态（需赞助 / 已授权）",
      "主流源：Greenhouse、Lever、Indeed 等 ATS",
      "谈薪维度含 base / equity / sign-on",
    ],
  },
  {
    flag: "🇯🇵",
    name: "日本",
    points: [
      "履歴書 + 職務経歴書 双书，格式严格区分",
      "通常需贴证件照、标注ふりがな、写出生日期",
      "主流源：Wantedly 等",
    ],
  },
] as const;

export default async function WelcomePage() {
  const stats = await getPublicStats();
  const updatedAt = new Date(stats.generatedAt).toLocaleDateString("zh-CN");

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-semibold">
            CareerOS
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/tools" className="hover:text-foreground">
              免费工具
            </Link>
            <Link href="/login" className="hover:text-foreground">
              进入应用
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        {/* Hero */}
        <section className="space-y-6 py-8 text-center">
          <Badge variant="secondary" className="mx-auto">
            职业知识库驱动的求职操作系统
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            让每一次求职，都沉淀为你的职业资产
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-lg text-muted-foreground">
            CareerOS 聚合中国、美国、日本的招聘源，用 AI 帮你匹配岗位、识别诈骗、生成多地区简历——
            所有洞察都汇入你专属、可累积的职业知识库。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/login">开始使用</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/tools">体验免费工具</Link>
            </Button>
          </div>
        </section>

        {/* 统计 */}
        <section className="grid grid-cols-1 gap-4 py-8 sm:grid-cols-3">
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <div className="text-4xl font-bold tabular-nums">
                <StatsCounter value={stats.users} />
              </div>
              <p className="text-sm text-muted-foreground">注册用户</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <div className="text-4xl font-bold tabular-nums">
                <StatsCounter value={stats.companies} />
              </div>
              <p className="text-sm text-muted-foreground">已收录公司</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-1 p-6 text-center">
              <div className="text-4xl font-bold tabular-nums">
                <StatsCounter value={stats.jobs} />
              </div>
              <p className="text-sm text-muted-foreground">在招岗位</p>
            </CardContent>
          </Card>
        </section>
        <p className="pb-4 text-center text-xs text-muted-foreground">
          数据统计截至 {updatedAt}（每小时更新）
        </p>

        {/* 功能 */}
        <section className="space-y-6 py-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">核心能力</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="flex flex-col transition-colors hover:border-foreground/30">
                <CardHeader>
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {f.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <CardTitle className="text-lg">{f.title}</CardTitle>
                  <CardDescription>{f.desc}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  {f.href.startsWith("/") ? (
                    <Link
                      href={f.href}
                      className="text-sm font-medium text-foreground/80 underline-offset-4 hover:underline"
                    >
                      了解 →
                    </Link>
                  ) : (
                    <a
                      href={f.href}
                      className="text-sm font-medium text-foreground/80 underline-offset-4 hover:underline"
                    >
                      了解 →
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* 多地区 */}
        <section id="regions" className="space-y-6 py-8">
          <h2 className="text-center text-2xl font-semibold tracking-tight">为不同地区定制简历</h2>
          <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
            中国、美国、日本对简历的要求截然不同。CareerOS 让你一次维护职业档案，按目标地区自动产出对应版本。
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {REGIONS.map((r) => (
              <Card key={r.name}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-2xl">{r.flag}</span>
                    {r.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {r.points.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-foreground/40">•</span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-10 text-center">
          <div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-muted/30 p-8">
            <h3 className="text-xl font-semibold">想让你的求职更聪明？</h3>
            <p className="text-sm text-muted-foreground">
              免费工具无需登录即可体验，注册后解锁多地区简历与职业知识库。
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/login">开始使用</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/tools">免费工具</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="space-y-2 border-t py-6 text-center text-xs text-muted-foreground">
        <div>CareerOS · 数据每小时更新 · 隐私优先，招聘文案类工具均在本地处理</div>
        <div className="space-x-3">
          <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">
            用户协议
          </Link>
          <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
            隐私政策
          </Link>
        </div>
      </footer>
    </div>
  );
}
