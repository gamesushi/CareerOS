"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, fmtDate } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Award, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Honor = {
  id: string;
  title: string;
  issuer?: string | null;
  date?: string | null;
  description?: string | null;
};

const EMPTY_FORM = { title: "", issuer: "", date: "", description: "" };

export function HonorTab() {
  const t = useT();
  const [items, setItems] = useState<Honor[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Honor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ data: Honor[] }>("/honors");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await api<{ data: Honor[] }>("/honors");
      if (active && res) setItems(res.data);
    })();
    return () => { active = false; };
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(h: Honor) {
    setEditing(h);
    setForm({
      title: h.title,
      issuer: h.issuer ?? "",
      date: fmtDate(h.date),
      description: h.description ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title.trim()) {
      toast.error(t("honor.requiredError"));
      return;
    }
    setSaving(true);
    const body = JSON.stringify({
      title: form.title,
      issuer: form.issuer || undefined,
      date: form.date || null,
      description: form.description || undefined,
    });
    const res = editing
      ? await api(`/honors/${editing.id}`, { method: "PUT", body })
      : await api("/honors", { method: "POST", body });
    setSaving(false);
    if (res) {
      toast.success(editing ? t("common.updated") : t("common.added"));
      setOpen(false);
      void load();
    }
  }

  async function remove(id: string) {
    const res = await api(`/honors/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      void load();
    }
  }

  if (!items) return <Skeleton className="mt-4 h-32" />;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="size-4" /> {t("honor.add")}</Button>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("honor.empty")}
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {items.map((h) => (
          <Card key={h.id}>
            <CardContent className="flex items-center gap-3 py-4">
              <Award className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{h.title}</p>
                <p className="text-xs text-muted-foreground">
                  {[h.issuer, h.date ? fmtDate(h.date).slice(0, 4) : null].filter(Boolean).join(" · ")}
                </p>
                {h.description && <p className="mt-1 text-xs text-muted-foreground">{h.description}</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(h)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => remove(h.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? t("honor.editTitle") : t("honor.addTitle")}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>{t("honor.title")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("honor.issuer")}</Label>
                <Input value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("honor.date")}</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("honor.description")}</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={save} disabled={saving}>{saving ? t("common.saving") : t("common.save")}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
