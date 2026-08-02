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
import { useT } from "@/lib/i18n/provider";

type JdRow = {
  id: string;
  company?: string | null;
  title?: string | null;
  status: "pending" | "parsing" | "parsed" | "failed";
  createdAt: string;
  latestMatch: { id: string; matchScore: string | number; createdAt: string } | null;
};

export default function JobsPage() {
  const router = useRouter();
  const t = useT();
  const [items, setItems] = useState<JdRow[] | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ data: JdRow[] }>("/jds");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      toast.success(t("jobs.parseStarted"));
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
        <h1 className="text-xl font-semibold">{t("jobs.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("jobs.subtitle")}
        </p>
      </div>

      <Card>
        <CardContent className="py-4">
          <Tabs defaultValue="text">
            <TabsList>
              <TabsTrigger value="text">{t("jobs.tab.text")}</TabsTrigger>
              <TabsTrigger value="url">{t("jobs.tab.url")}</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-3 pt-2">
              <Textarea
                rows={5}
                placeholder={t("jobs.textPlaceholder")}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <Button disabled={submitting || text.trim().length < 50} onClick={() => importJd({ text })}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : t("jobs.parseJd")}
              </Button>
              {text.trim().length > 0 && text.trim().length < 50 && (
                <p className="text-xs text-muted-foreground">{t("jobs.tooShort")}</p>
              )}
            </TabsContent>
            <TabsContent value="url" className="space-y-3 pt-2">
              <Input placeholder={t("jobs.urlPlaceholder")} value={url} onChange={(e) => setUrl(e.target.value)} />
              <Button disabled={submitting || !url.startsWith("http")} onClick={() => importJd({ url })}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : t("jobs.fetchAndParse")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("jobs.urlHint")}</p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("jobs.library")}</h2>
        {!items && <Skeleton className="h-24" />}
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("jobs.libraryEmpty")}</p>
        )}
        {items?.map((jd) => (
          <Card key={jd.id}>
            <CardContent className="flex items-center gap-3 py-3">
              <div
                className="min-w-0 flex-1 cursor-pointer"
                onClick={() => jd.status === "parsed" && router.push(`/jobs/${jd.id}`)}
              >
                <p className="truncate text-sm font-medium">
                  {[jd.company, jd.title].filter(Boolean).join(" · ") || t("jobs.jdAutoDetect")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(jd.createdAt).toLocaleString("zh-CN")} · {t(`jobs.jdStatus.${jd.status}`)}
                </p>
              </div>
              {jd.latestMatch && (
                <Badge variant="secondary" className="shrink-0">
                  {t("jobs.latestMatch", { score: Number(jd.latestMatch.matchScore).toFixed(0) })}
                </Badge>
              )}
              {(jd.status === "pending" || jd.status === "parsing") && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {jd.status === "parsed" && (
                <Button size="sm" onClick={() => match(jd)}>
                  <Target className="size-4" /> {t("jobs.match")}
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
