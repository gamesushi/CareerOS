"use client";

// 站内投递弹窗：选一份已有简历 + 写求职信。
// 只对站内发布岗（origin=posted）出现——外链抓取岗没有站内投递这回事。

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type MyResume = { id: string; title: string; resumeType: string; updatedAt: string };

export function ApplyDialog({
  jobPostingId,
  jobTitle,
  company,
  onApplied,
}: {
  jobPostingId: string;
  jobTitle: string;
  company?: string | null;
  onApplied: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [resumes, setResumes] = useState<MyResume[] | null>(null);
  const [resumeId, setResumeId] = useState<string>("");
  const [coverLetter, setCoverLetter] = useState("");
  const [sending, setSending] = useState(false);

  // 简历列表懒加载：只在真的打开弹窗时才拉，避免列表页每张卡片都发一次请求
  useEffect(() => {
    if (!open || resumes) return;
    void api<{ data: MyResume[] }>("/resumes").then((res) => {
      if (!res) return;
      setResumes(res.data);
      if (res.data[0]) setResumeId(res.data[0].id);
    });
  }, [open, resumes]);

  async function submit() {
    setSending(true);
    const res = await api<{ id: string }>(`/job-postings/${jobPostingId}/applications`, {
      method: "POST",
      body: JSON.stringify({
        resumeId: resumeId || undefined,
        coverLetter: coverLetter.trim() || undefined,
      }),
    });
    setSending(false);
    if (res) {
      toast.success(t("apply.submitted"));
      setOpen(false);
      setCoverLetter("");
      onApplied();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Send className="size-3.5" /> {t("apply.action")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("apply.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {[company, jobTitle].filter(Boolean).join(" · ")}
          </p>

          <div className="space-y-1.5">
            <Label>{t("apply.resume")}</Label>
            {!resumes ? (
              <p className="text-xs text-muted-foreground">{t("apply.loadingResumes")}</p>
            ) : resumes.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("apply.noResume")}</p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1.5">
                {resumes.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setResumeId(r.id)}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                      resumeId === r.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <span className="shrink-0 text-[10px] opacity-70">{r.resumeType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>{t("apply.coverLetter")}</Label>
            <Textarea
              rows={5}
              placeholder={t("apply.coverLetterPlaceholder")}
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t("apply.privacyHint")}</p>
        </div>
        <DialogFooter>
          <Button disabled={sending} onClick={submit}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("apply.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
