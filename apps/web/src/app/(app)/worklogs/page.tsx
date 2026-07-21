"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles, Trash2 } from "lucide-react";

type Suggestion = {
  skills: { name: string; skillId: string | null }[];
  projects: { name: string; projectId: string | null }[];
};

type WorkLog = {
  id: string;
  logDate: string;
  title: string;
  content: string;
  tags: string[];
  aiSummary?: string | null;
  aiSuggestions?: Suggestion | null;
  projects: { project: { id: string; name: string } }[];
  skills: { skill: { id: string; name: string } }[];
};

type ProjectOption = { id: string; name: string };
const NONE = "__none__";

export default function WorkLogsPage() {
  const t = useT();
  const [items, setItems] = useState<WorkLog[] | null>(null);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [form, setForm] = useState({
    title: "", content: "", tags: "", projectId: NONE,
    logDate: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [logsRes, projRes] = await Promise.all([
      api<{ data: WorkLog[] }>("/worklogs"),
      api<{ data: ProjectOption[] }>("/projects"),
    ]);
    if (logsRes) setItems(logsRes.data);
    if (projRes) setProjects(projRes.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // 有日志缺摘要时轮询（summarize 异步完成后自动出现）
  useEffect(() => {
    if (!items?.some((l) => !l.aiSummary)) return;
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [items, load]);

  async function save() {
    if (!form.title || !form.content) {
      toast.error(t("worklogs.requiredError"));
      return;
    }
    setSaving(true);
    const res = await api("/worklogs", {
      method: "POST",
      body: JSON.stringify({
        logDate: form.logDate,
        title: form.title,
        content: form.content,
        tags: form.tags.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
        projectIds: form.projectId === NONE ? [] : [form.projectId],
        skillIds: [],
      }),
    });
    setSaving(false);
    if (res) {
      toast.success(t("worklogs.recorded"));
      setForm({ ...form, title: "", content: "", tags: "" });
      void load();
    }
  }

  async function acceptSuggestions(log: WorkLog) {
    if (!log.aiSuggestions) return;
    const res = await api<{ evidenceCount: number }>(`/worklogs/${log.id}/accept-suggestions`, {
      method: "POST",
      body: JSON.stringify({
        skills: log.aiSuggestions.skills,
        projectIds: log.aiSuggestions.projects.map((p) => p.projectId).filter(Boolean),
      }),
    });
    if (res) {
      toast.success(t("worklogs.accepted", { count: res.evidenceCount }));
      void load();
    }
  }

  async function dismissSuggestions(log: WorkLog) {
    await api(`/worklogs/${log.id}/accept-suggestions`, {
      method: "POST",
      body: JSON.stringify({ skills: [], projectIds: [] }),
    });
    void load();
  }

  async function remove(id: string) {
    const res = await api(`/worklogs/${id}`, { method: "DELETE" });
    if (res) void load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("worklogs.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("worklogs.subtitle")}
        </p>
      </div>

      {/* QuickComposer */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex gap-2">
            <Input
              type="date"
              className="w-36 shrink-0"
              value={form.logDate}
              onChange={(e) => setForm({ ...form, logDate: e.target.value })}
            />
            <Input
              placeholder={t("worklogs.titlePlaceholder")}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <Textarea
            rows={3}
            placeholder={t("worklogs.contentPlaceholder")}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void save();
            }}
          />
          <div className="flex gap-2">
            <Input
              className="flex-1"
              placeholder={t("worklogs.tagsPlaceholder")}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
            <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("worklogs.noProject")}</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : t("worklogs.record")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 日志流 */}
      {!items && <Skeleton className="h-40" />}
      {items?.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t("worklogs.empty")}
        </p>
      )}
      <div className="space-y-3">
        {items?.map((log) => (
          <Card key={log.id}>
            <CardContent className="space-y-2 py-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{log.title}</p>
                  <p className="text-xs text-muted-foreground">{log.logDate.slice(0, 10)}</p>
                </div>
                <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => remove(log.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {log.aiSummary ? (
                <p className="rounded-md bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                  <Sparkles className="mr-1 inline size-3.5" />
                  {log.aiSummary}
                </p>
              ) : (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" /> {t("worklogs.summarizing")}
                </p>
              )}

              <p className="line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">{log.content}</p>

              {(log.tags.length > 0 || log.projects.length > 0 || log.skills.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {log.projects.map((p) => (
                    <Badge key={p.project.id} variant="secondary" className="font-normal">📁 {p.project.name}</Badge>
                  ))}
                  {log.skills.map((s) => (
                    <Badge key={s.skill.id} variant="secondary" className="font-normal">✦ {s.skill.name}</Badge>
                  ))}
                  {log.tags.map((t) => (
                    <Badge key={t} variant="outline" className="font-normal">#{t}</Badge>
                  ))}
                </div>
              )}

              {/* SuggestionRow：飞轮的采纳点 */}
              {log.aiSuggestions && (log.aiSuggestions.skills.length > 0 || log.aiSuggestions.projects.length > 0) && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2">
                  <span className="text-xs text-muted-foreground">{t("worklogs.aiDetected")}</span>
                  {log.aiSuggestions.skills.map((s) => (
                    <Badge key={s.name} variant="outline" className="font-normal">
                      {s.name}{s.skillId ? "" : t("worklogs.newSuffix")}
                    </Badge>
                  ))}
                  {log.aiSuggestions.projects.map((p) => (
                    <Badge key={p.name} variant="outline" className="font-normal">📁 {p.name}</Badge>
                  ))}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => dismissSuggestions(log)}>
                      {t("worklogs.ignore")}
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={() => acceptSuggestions(log)}>
                      {t("worklogs.acceptAsEvidence")}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
