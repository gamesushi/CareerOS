"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/provider";

type App = {
  id: string;
  title: string;
  company?: string | null;
  location?: string | null;
  salary?: string | null;
  url?: string | null;
  stage: string;
  matchScore?: number | null;
  nextAction?: string | null;
  resume?: { id: string; title: string } | null;
};

const STAGES = ["considering", "applied", "screening", "interview", "offer", "rejected"] as const;

export default function ApplicationsPage() {
  const t = useT();
  const router = useRouter();
  const [apps, setApps] = useState<App[] | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", company: "", url: "" });
  const [dragId, setDragId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ data: App[] }>("/applications");
    if (r) setApps(r.data);
  }, []);
  useEffect(() => {
    let active = true;
    void (async () => {
      const r = await api<{ data: App[] }>("/applications");
      if (active && r) setApps(r.data);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function move(id: string, stage: string) {
    const cur = apps?.find((a) => a.id === id);
    if (!cur || cur.stage === stage) return;
    setApps((prev) => (prev ? prev.map((a) => (a.id === id ? { ...a, stage } : a)) : prev));
    const r = await api(`/applications/${id}`, { method: "PATCH", body: JSON.stringify({ stage }) });
    if (!r) void load();
  }

  async function create() {
    if (!form.title.trim()) return;
    const r = await api<{ data: App }>("/applications", {
      method: "POST",
      body: JSON.stringify({ title: form.title.trim(), company: form.company.trim() || undefined, url: form.url.trim() || undefined }),
    });
    if (r) {
      toast.success(t("apps.added"));
      setForm({ title: "", company: "", url: "" });
      setShowNew(false);
      void load();
    }
  }

  const scoreColor = (s?: number | null) =>
    s == null ? "" : s >= 60 ? "bg-emerald-500/15 text-emerald-600" : s >= 30 ? "bg-amber-500/15 text-amber-600" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{t("apps.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("apps.desc")}</p>
        </div>
        <Button size="sm" onClick={() => setShowNew((v) => !v)}>
          <Plus className="size-4" /> {t("apps.new")}
        </Button>
      </div>

      {showNew && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={t("apps.titlePh")} className="w-48 rounded-md border bg-background px-2 py-1.5 text-sm" />
          <input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder={t("apps.companyPh")} className="w-40 rounded-md border bg-background px-2 py-1.5 text-sm" />
          <input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder={t("apps.urlPh")} className="w-52 rounded-md border bg-background px-2 py-1.5 text-sm" />
          <Button size="sm" disabled={!form.title.trim()} onClick={create}>{t("apps.add")}</Button>
          <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}>{t("common.cancel")}</Button>
        </div>
      )}

      {!apps ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((st) => {
            const cards = apps.filter((a) => a.stage === st);
            return (
              <div
                key={st}
                className="flex w-64 shrink-0 flex-col rounded-lg border bg-muted/30"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dragId && move(dragId, st)}
                data-stage={st}
              >
                <div className="flex items-center justify-between px-3 py-2 text-sm font-medium">
                  <span>{t(`apps.stage.${st}`)}</span>
                  <span className="rounded bg-muted px-1.5 text-xs text-muted-foreground">{cards.length}</span>
                </div>
                <div className="flex min-h-[80px] flex-col gap-2 px-2 pb-2">
                  {cards.map((a) => (
                    <div
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onDragEnd={() => setDragId(null)}
                      onClick={() => router.push(`/applications/${a.id}`)}
                      className="cursor-pointer rounded-md border bg-card p-2.5 text-sm shadow-sm hover:border-primary/50"
                      data-app-id={a.id}
                    >
                      <div className="flex items-start gap-1.5">
                        <span className="min-w-0 flex-1 font-medium leading-tight">{a.title}</span>
                        {typeof a.matchScore === "number" && (
                          <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold ${scoreColor(a.matchScore)}`}>{Math.round(a.matchScore)}</span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{[a.company, a.location].filter(Boolean).join(" · ") || "—"}</p>
                      {a.resume && <p className="mt-1 truncate text-[11px] text-muted-foreground">{t("apps.resumeLabel")}{a.resume.title}</p>}
                      {a.nextAction && <p className="mt-1 truncate text-[11px] text-primary">{t("apps.nextLabel")}{a.nextAction}</p>}
                    </div>
                  ))}
                  {cards.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted-foreground/60">{t("apps.dropHere")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
