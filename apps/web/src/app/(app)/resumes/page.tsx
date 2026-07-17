"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Plus, Trash2 } from "lucide-react";

type ResumeRow = {
  id: string;
  title: string;
  resumeType: "zh" | "en" | "ja_shokumu";
  version: number;
  status: string;
  generatedAt: string;
  jd?: { company?: string | null; title?: string | null } | null;
};

type JdOption = { id: string; company?: string | null; title?: string | null; status: string };

const TYPE_LABEL: Record<string, string> = { zh: "中文", en: "EN", ja_shokumu: "職務経歴書" };
const NONE = "__none__";

export default function ResumesPage() {
  const router = useRouter();
  const [items, setItems] = useState<ResumeRow[] | null>(null);
  const [jds, setJds] = useState<JdOption[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ jdId: NONE, resumeType: "zh" });
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [resumesRes, jdsRes] = await Promise.all([
      api<{ data: ResumeRow[] }>("/resumes"),
      api<{ data: JdOption[] }>("/jds"),
    ]);
    if (resumesRes) setItems(resumesRes.data);
    if (jdsRes) setJds(jdsRes.data.filter((j) => j.status === "parsed"));
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setGenerating(true);
    const res = await api<{ resumeId: string }>("/resumes/generate", {
      method: "POST",
      body: JSON.stringify({
        jdId: form.jdId === NONE ? null : form.jdId,
        resumeType: form.resumeType,
      }),
    });
    setGenerating(false);
    if (res) {
      setOpen(false);
      router.push(`/resumes/${res.resumeId}`);
    }
  }

  async function remove(id: string) {
    const res = await api(`/resumes/${id}`, { method: "DELETE" });
    if (res) {
      toast.success("已删除");
      void load();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">简历中心</h1>
          <p className="text-sm text-muted-foreground">
            简历是职业数据库的视图——想改事实去知识库，这里只管生成、微调与导出。
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="size-4" /> 生成简历</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>生成简历</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>目标 JD（可选，将按相关度选材）</Label>
                <Select value={form.jdId} onValueChange={(v) => setForm({ ...form, jdId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>不指定（通用简历）</SelectItem>
                    {jds.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {[j.company, j.title].filter(Boolean).join(" · ") || j.id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>语言 / 格式</Label>
                <Select value={form.resumeType} onValueChange={(v) => setForm({ ...form, resumeType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="zh">中文简历</SelectItem>
                    <SelectItem value="en">English Resume</SelectItem>
                    <SelectItem value="ja_shokumu">日本語 職務経歴書</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={generate} disabled={generating}>
                {generating ? "创建中…" : "开始生成"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!items && <Skeleton className="h-40" />}
      {items?.length === 0 && (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          还没有简历。点击右上角「生成简历」，从职业数据库生成第一份。
        </CardContent></Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {items?.map((r) => (
          <Card
            key={r.id}
            className="cursor-pointer transition-colors hover:bg-accent/40"
            onClick={() => router.push(`/resumes/${r.id}`)}
          >
            <CardContent className="flex items-start gap-3 py-4">
              <FileText className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">
                  v{r.version} · {new Date(r.generatedAt).toLocaleString("zh-CN")}
                </p>
                <div className="mt-1.5 flex gap-1.5">
                  <Badge variant="secondary" className="font-normal">{TYPE_LABEL[r.resumeType]}</Badge>
                  <Badge variant="outline" className="font-normal">{r.status === "final" ? "定稿" : "草稿"}</Badge>
                </div>
              </div>
              <Button
                variant="ghost" size="icon" className="size-7 shrink-0"
                onClick={(e) => { e.stopPropagation(); void remove(r.id); }}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
