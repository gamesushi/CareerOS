import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const tools = [
  {
    href: "/tools/matcher",
    title: "简历 ↔ JD 关键词匹配器",
    desc: "粘贴简历与岗位 JD，实时计算关键词重合度，高亮命中与缺失关键词。纯前端、零上传。",
  },
  {
    href: "/tools/scam-checker",
    title: "幽灵岗 / 诈骗招聘检测",
    desc: "粘贴招聘文案，AI 识别入职押金、培训贷、刷单垫付等红旗并给出风险等级。",
  },
  {
    href: "/tools/leaderboard",
    title: "公司 / 来源招聘排行榜",
    desc: "基于多源岗位监测数据，按在招职位数排名的热门公司与招聘来源，可筛选远程。",
  },
];

export default function ToolsHome() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">免费求职工具</h1>
        <p className="text-muted-foreground">
          CareerOS 公开工具集，帮你更聪明地找工作。所有工具无需登录，数据留在本地。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <CardTitle>{t.title}</CardTitle>
                <CardDescription>{t.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  打开工具 <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
