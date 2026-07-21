"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, RefreshCw } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type ProfileData = {
  headline?: string | null;
  summary?: string | null;
  careerTags: string[];
  careerLevel?: string | null;
  yearsExperience?: string | number | null;
  isStale: boolean;
};

const JOB_STATUS_KEY: Record<string, string> = {
  open: "profile.status.open", passive: "profile.status.passive", closed: "profile.status.closed",
};

const LEVEL_KEY: Record<string, string> = {
  junior: "profile.level.junior", mid: "profile.level.mid", senior: "profile.level.senior", staff: "profile.level.staff", exec: "profile.level.exec",
};

export function ProfileHero({
  name, jobStatus, profile, hasData,
}: {
  name: string; jobStatus: string; profile: ProfileData | null; hasData: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [generating, setGenerating] = useState(false);

  async function regenerate() {
    setGenerating(true);
    const res = await api("/career/profile/regenerate", { method: "POST" });
    if (!res) {
      setGenerating(false);
      return;
    }
    // 轮询直到 isStale=false（任务完成）
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const p = await api<ProfileData>("/career/profile", { silent: true });
      if (p && !p.isStale) {
        setGenerating(false);
        toast.success(t("profile.updated"));
        router.refresh();
        return;
      }
    }
    setGenerating(false);
    toast.error(t("profile.timeout"));
  }

  return (
    <Card>
      <CardContent className="space-y-3 py-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">{name}</h1>
              <Badge variant="secondary">{JOB_STATUS_KEY[jobStatus] ? t(JOB_STATUS_KEY[jobStatus]) : jobStatus}</Badge>
              {profile?.careerLevel && (
                <Badge variant="outline">{LEVEL_KEY[profile.careerLevel] ? t(LEVEL_KEY[profile.careerLevel]) : profile.careerLevel}</Badge>
              )}
              {profile?.yearsExperience != null && (
                <Badge variant="outline">{t("profile.yearsExperience", { years: Number(profile.yearsExperience).toFixed(0) })}</Badge>
              )}
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {profile?.headline ?? t("profile.placeholder")}
            </p>
          </div>
          {hasData && (
            <Button variant="outline" size="sm" onClick={regenerate} disabled={generating}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              {profile?.headline ? t("profile.regenerate") : t("profile.generate")}
            </Button>
          )}
        </div>

        {profile?.summary && <p className="text-sm leading-relaxed text-muted-foreground">{profile.summary}</p>}

        {(profile?.careerTags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {profile!.careerTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
            ))}
          </div>
        )}

        {profile?.isStale && profile?.headline && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {t("profile.staleHint")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
