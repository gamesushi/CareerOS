"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Target, Trash2 } from "lucide-react";

type JdRow = {
  id: string;
  company?: string | null;
  title?: string | null;
  status: "pending" | "parsing" | "parsed" | "failed";
  createdAt: string;
  latestMatch: { id: string; matchScore: string | number; createdAt: string } | null;
};

const STATUS_LABEL: Record<JdRow["status"], string> = {
  pending: "排队中", parsing: "解析中", parsed: "已解析", failed: "解析失败",
};

export default function JobsPage() {
  const router = useRouter();
  const [items, setItems] = useState<JdRow[] | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ data: JdRow[] }>("/jds");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!items?.some((i) => i.status === "pending" || i.status === "parsing")) return;
    const timer = setInterval(load, 2000);
    return () => clearInterval(timer);
  }, [items, load]);

  async function importJd(body: { text?: string; url?: string }) {
    setSubmitting(true);
    const res = await api<{ jdId: string }>("/jds/import", { method: "POST", body: JSON.stringify(body) });
    setSubmitting(false);
    if (res) {
      toast.success("已开始解析 JD");
      setText("");
      setUrl("");
      void load();
    }
  }

  async function match(jd: JdRow) {
    const res = await api<{ matchId: string }>(`/jds/${jd.id}/match`, { method: "POST" });
    if (res) router.push(`/jobs/${jd.id}?match=${res.matchId}`);
  }

  async function remove(id: string) {
    const res = await api(`/jds/${id}`, { method: "DELETE" });
    if (res) void load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">岗位匹配</h1>
        <p className="text-sm text-muted-foreground">
          导入 JD → AI 解析要求 → 用职业数据库打匹配分，缺什么一目了然。
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">粘贴文本</TabsTrigger>
              <TabsTrigger value="url">粘贴链接</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-3 pt-2">
              <Textarea
                rows={5}
                placeholder="把 JD 全文粘贴到这里…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Button disabled={submitting || text.trim().length < 50} onClick={() => importJd({ text })}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "解析 JD"}
              </Button>
              {text.trim().length > 0 && text.trim().length < 50 && (
                <p className="text-xs text-muted-foreground">内容太短（至少 50 字）</p>
              )}
            </TabsContent>
            <TabsContent value="url" className="space-y-3 pt-2">
              <Input placeholder="https://…（招聘页面链接）" value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button disabled={submitting || !url.startsWith("http")} onClick={() => importJd({ url })}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : "抓取并解析"}
              </Button>
              <p className="text-xs text-muted-foreground">部分招聘站有反爬，抓取失败时请改用粘贴文本。</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">JD 库</h2>
        {!items && <Skeleton className="h-24" />}
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">还没有 JD，粘贴一个试试。</p>
        )}
        {items?.map((jd) => (
          <Card key={jd.id}>
            <CardContent className="flex items-center gap-3 py-3">
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => jd.status === "parsed" && router.push(`/jobs/${jd.id}`)}
              >
                <p className="truncate text-sm font-medium">
                  {[jd.company, jd.title].filter(Boolean).join(" · ") || "（解析中将自动识别公司与职位）"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(jd.createdAt).toLocaleString("zh-CN")} · {STATUS_LABEL[jd.status]}
                </p>
              </div>
              {jd.latestMatch && (
                <Badge variant="secondary" className="shrink-0">
                  最近匹配 {Number(jd.latestMatch.matchScore).toFixed(0)} 分
                </Badge>
              )}
              {(jd.status === "pending" || jd.status === "parsing") && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {jd.status === "parsed" && (
                <Button size="sm" onClick={() => match(jd)}>
                  <Target className="size-4" /> 匹配
                </Button>
              )}
              <Button variant="ghost" size="icon" className="size-8" onClick={() => remove(jd.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
