"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Inbox, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { type Posting } from "./types";

export function MyPostings() {
  const t = useT();
  const [items, setItems] = useState<Posting[] | null>(null);

  const load = useCallback(async () => {
    const res = await api<{ data: Posting[] }>("/job-postings");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeStatus(p: Posting, status: "draft" | "open" | "closed") {
    const res = await api(`/job-postings/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res) void load();
  }

  async function remove(p: Posting) {
    if (!window.confirm(t("employer.confirmDelete"))) return;
    const res = await api(`/job-postings/${p.id}`, { method: "DELETE" });
    if (res) void load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("employer.manageTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("employer.manageSubtitle")}</p>
      </div>

      <div className="space-y-2">
        {!items && <Skeleton className="h-24" />}
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("employer.empty")}</p>
        )}
        {items?.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.title}</span>
                {p.org ? (
                  <a
                    href={`/c/${p.org.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {p.company}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">{p.company}</span>
                )}
                {p.location && <span className="text-xs text-muted-foreground">{p.location}</span>}
                {p.salary && <span className="text-xs text-muted-foreground">{p.salary}</span>}
                {p.referralCode && (
                  <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
                    {t("jobs.referralCodeBadge", { code: p.referralCode })}
                  </span>
                )}
                <StatusBadges posting={p} t={t} />
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>

              {p.reviewStatus === "rejected" && p.reviewNote && (
                <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {t("employer.rejectedNote", { note: p.reviewNote })}
                </p>
              )}

              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/employer/jobs/${p.id}/applications`}>
                    <Inbox className="size-3.5" />
                    {t("employer.applications", { n: p._count?.applications ?? 0 })}
                  </Link>
                </Button>
                {p.status !== "open" && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(p, "open")}>
                    {p.status === "draft" ? t("employer.publish") : t("employer.reopen")}
                  </Button>
                )}
                {p.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(p, "closed")}>
                    {t("employer.close")}
                  </Button>
                )}
                {p.status === "draft" && (
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** 状态徽标：发布状态（草稿/在招/已下架）+ 审核状态 + 管理员下架。 */
function StatusBadges({
  posting: p,
  t,
}: {
  posting: Posting;
  t: (k: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <Badge variant={p.status === "open" ? "default" : "secondary"}>
        {t(`employer.status.${p.status}`)}
      </Badge>
      {p.takenDownAt ? (
        <Badge variant="destructive">{t("employer.takenDown")}</Badge>
      ) : (
        p.status !== "draft" && (
          <Badge
            variant={p.reviewStatus === "approved" ? "outline" : "secondary"}
            className={p.reviewStatus === "rejected" ? "text-destructive" : ""}
          >
            {t(`employer.review.${p.reviewStatus}`)}
          </Badge>
        )
      )}
    </>
  );
}
