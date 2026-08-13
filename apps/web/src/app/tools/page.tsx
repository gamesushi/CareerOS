"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";

const toolKeys = [
  { href: "/tools/matcher", titleKey: "tools.matcher.title", descKey: "tools.matcher.desc" },
  { href: "/tools/scam-checker", titleKey: "tools.scam.title", descKey: "tools.scam.desc" },
  { href: "/tools/leaderboard", titleKey: "tools.leaderboard.title", descKey: "tools.leaderboard.desc" },
];

export default function ToolsHome() {
  const t = useT();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("tools.title")}</h1>
        <p className="text-muted-foreground">
          {t("tools.subtitle")}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {toolKeys.map((tk) => (
          <Link key={tk.href} href={tk.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardHeader>
                <CardTitle>{t(tk.titleKey)}</CardTitle>
                <CardDescription>{t(tk.descKey)}</CardDescription>
              </CardHeader>
              <CardContent>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  {t("tools.open")} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
