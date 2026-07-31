"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";
import { api, fmtDate } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT } from "@/lib/i18n/provider";

type Event = { id: string; kind: string; fromStage?: string | null; toStage?: string | null; note?: string | null; createdAt: string };
type Detail = {
  id: string; title: string; company?: string | null; location?: string | null; salary?: string | null;
  url?: string | null; stage: string; matchScore?: number | null; notes?: string | null;
  nextAction?: string | null; nextActionAt?: string | null; source?: string | null;
  resume?: { id: string; title: string } | null; events: Event[];
};

const STAGES = ["considering", "applied", "screening", "interview", "offer", "rejected"] as const;

export default function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const router = useRouter();
  const stageLabel = (k?: string | null) => (k && (STAGES as readonly string[]).includes(k) ? t(`apps.stage.${k}`) : k ?? "—");
  const [d, setD] = useState<Detail | null>(null);
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextAt, setNextAt] = useState("");
  const [newNote, setNewNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumes, setResumes] = useState<{ id: string; title: string }[]>([]);

  const load = useCallback(async () => {
    const r = await api<{ data: Detail }>(`/applications/${id}`);
    if (r) {
      setD(r.data);
      setNotes(r.data.notes ?? "");
      setNextAction(r.data.nextAction ?? "");
      setNextAt(r.data.nextActionAt ? fmtDate(r.data.nextActionAt) : "");
    }
  }, [id]);
  useEffect(() => {
    let active = true;
    void (async () => {
      const [r, rz] = await Promise.all([
        api<{ data: Detail }>(`/applications/${id}`),
        api<{ data: { id: string; title: string }[] }>(`/resumes`, { silent: true }),
      ]);
      if (active && r) {
        setD(r.data);
        setNotes(r.data.notes ?? "");
        setNextAction(r.data.nextAction ?? "");
        setNextAt(r.data.nextActionAt ? fmtDate(r.data.nextActionAt) : "");
      }
      if (active && rz) setResumes(rz.data);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  async function patch(body: Record<string, unknown>, msg?: string) {
    setBusy(true);
    const r = await api(`/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    setBusy(false);
    if (r) {
      if (msg) toast.success(msg);
      void load();
    }
  }

  async function addNote() {
    if (!newNote.trim()) return;
    const r = await api(`/applications/${id}/events`, { method: "POST", body: JSON.stringify({ note: newNote.trim() }) });
    if (r) { setNewNote(""); toast.success(t("apps.recorded")); void load(); }
  }

  async function remove() {
    if (!window.confirm(t("apps.deleteConfirm"))) return;
    const r = await api(`/applications/${id}`, { method: "DELETE" });
    if (r) { toast.success(t("apps.deleted")); router.push("/applications"); }
  }

  if (!d) return <Skeleton className="h-64" />;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <button onClick={() => router.push("/applications")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("apps.back")}
      </button>

      <header>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">{d.title}</h1>
          {typeof d.matchScore === "number" && <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{t("apps.match")} {Math.round(d.matchScore)}</span>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {[d.company, d.location, d.salary].filter(Boolean).join(" · ") || "—"}
          {d.url && <> · <a href={d.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{t("apps.origLink")} <ExternalLink className="inline size-3" /></a></>}
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-16 text-muted-foreground">{t("apps.stage")}</span>
          <select value={d.stage} disabled={busy} onChange={(e) => patch({ stage: e.target.value }, t("apps.stageUpdated"))} className="rounded-md border bg-background px-2 py-1 text-sm">
            {STAGES.map((s) => <option key={s} value={s}>{t(`apps.stage.${s}`)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-16 text-muted-foreground">{t("apps.resume")}</span>
          <select
            value={d.resume?.id ?? ""}
            disabled={busy}
            onChange={(e) => patch({ resumeId: e.target.value || null }, t("apps.linked"))}
            className="rounded-md border bg-background px-2 py-1 text-sm"
          >
            <option value="">{t("apps.resumeNone")}</option>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{t("apps.resumeHint")}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="w-16 text-muted-foreground">{t("apps.next")}</span>
          <input value={nextAction} onChange={(e) => setNextAction(e.target.value)} placeholder={t("apps.nextPh")} className="w-56 rounded-md border bg-background px-2 py-1 text-sm" />
          <input type="date" value={nextAt} onChange={(e) => setNextAt(e.target.value)} className="rounded-md border bg-background px-2 py-1 text-sm" />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ nextAction: nextAction || null, nextActionAt: nextAt ? new Date(nextAt).toISOString() : null }, t("apps.saved"))}>{t("common.save")}</Button>
        </div>
        <div className="space-y-1 text-sm">
          <span className="text-muted-foreground">{t("apps.notes")}</span>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border bg-background px-2 py-1.5 text-sm" />
          <Button size="sm" variant="outline" disabled={busy} onClick={() => patch({ notes: notes || null }, t("apps.notesSaved"))}>{t("apps.saveNotes")}</Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">{t("apps.timeline")}</h2>
        <div className="flex gap-2">
          <input value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t("apps.addRecord")} className="flex-1 rounded-md border bg-background px-2 py-1 text-sm" onKeyDown={(e) => e.key === "Enter" && addNote()} />
          <Button size="sm" variant="outline" onClick={addNote}>{t("apps.record")}</Button>
        </div>
        <ul className="mt-3 space-y-2">
          {d.events.map((e) => (
            <li key={e.id} className="flex gap-2 text-xs">
              <span className="w-24 shrink-0 text-muted-foreground">{new Date(e.createdAt).toLocaleString(undefined, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              <span className="flex-1">
                {e.kind === "created" && t("apps.evtCreated")}
                {e.kind === "stage_change" && `${t("apps.evtStage")}${stageLabel(e.fromStage)} → ${stageLabel(e.toStage)}`}
                {e.kind === "note" && e.note}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <Button variant="ghost" size="sm" className="text-destructive" onClick={remove}>
        <Trash2 className="size-4" /> {t("apps.delete")}
      </Button>
    </div>
  );
}
