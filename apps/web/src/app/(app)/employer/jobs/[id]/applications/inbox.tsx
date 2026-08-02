"use client";

// 雇主收件箱：看投递、读候选人投来的那份简历、流转状态、写备注。
// 备注（employerNote）只在这条路径出现，候选人侧接口一律不返回。

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FileText } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Application = {
  id: string;
  status: string;
  coverLetter?: string | null;
  employerNote?: string | null;
  createdAt: string;
  candidate: { name: string; email: string; image?: string | null };
  resume?: { id: string; title: string; resumeType: string } | null;
};

/** 雇主可推进的状态。withdrawn 不在其中——撤回是候选人的动作。 */
const NEXT_STATUSES = ["screening", "interview", "offer", "rejected"] as const;
const TERMINAL = ["offer", "rejected", "withdrawn"];

export function ApplicationInbox({
  posting,
  initial,
}: {
  posting: { id: string; title: string; company: string };
  initial: Application[];
}) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    const res = await api<{ status: string }>(`/job-applications/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (res) {
      setItems((list) => list.map((a) => (a.id === id ? { ...a, ...res } : a)));
      toast.success(t("inbox.updated"));
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{posting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {posting.company} · {t("inbox.count", { n: items.length })}
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/employer/jobs">
            <ArrowLeft className="size-4" /> {t("inbox.back")}
          </Link>
        </Button>
      </div>

      {items.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("inbox.empty")}</p>
      )}

      {items.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-3 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.candidate.name || t("inbox.anonymous")}</span>
              <a
                href={`mailto:${a.candidate.email}`}
                className="text-sm text-muted-foreground hover:underline"
              >
                {a.candidate.email}
              </a>
              <Badge variant={TERMINAL.includes(a.status) ? "secondary" : "default"}>
                {t(`applyStatus.${a.status}`)}
              </Badge>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(a.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </span>
            </div>

            {a.resume ? (
              <a
                href={`/api/v1/job-applications/${a.id}/resume?inline=1`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent"
              >
                <FileText className="size-3.5" />
                {a.resume.title}
                <span className="text-xs text-muted-foreground">({a.resume.resumeType})</span>
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">{t("inbox.noResume")}</p>
            )}

            {a.coverLetter && (
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {a.coverLetter}
              </p>
            )}

            {a.status === "withdrawn" ? (
              <p className="text-xs text-muted-foreground">{t("inbox.withdrawnHint")}</p>
            ) : (
              !TERMINAL.includes(a.status) && (
                <div className="flex flex-wrap gap-1.5">
                  {NEXT_STATUSES.filter((s) => s !== a.status).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={s === "rejected" ? "outline" : "default"}
                      disabled={busy === a.id}
                      onClick={() => patch(a.id, { status: s })}
                    >
                      {t(`inbox.moveTo.${s}`)}
                    </Button>
                  ))}
                </div>
              )
            )}

            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {t("inbox.note")}
              </summary>
              <div className="mt-2 space-y-2">
                <Textarea
                  rows={2}
                  defaultValue={a.employerNote ?? ""}
                  placeholder={t("inbox.notePlaceholder")}
                  onBlur={(e) => {
                    const v = e.target.value.trim();
                    if (v !== (a.employerNote ?? "")) void patch(a.id, { employerNote: v });
                  }}
                />
                <p className="text-xs text-muted-foreground">{t("inbox.notePrivate")}</p>
              </div>
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
