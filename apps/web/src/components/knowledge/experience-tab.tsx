"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api, fmtDate, fmtRange } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Experience = {
  id: string;
  company: string;
  department?: string | null;
  title: string;
  employmentType?: string | null;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  description?: string | null;
  highlights: string[];
  projects: { id: string; name: string }[];
  achievements: { id: string; title: string }[];
};

const EMPTY_FORM = {
  company: "", department: "", title: "", employmentType: "", startDate: "", endDate: "",
  location: "", description: "", highlights: "",
};

export function ExperienceTab() {
  const t = useT();
  const [items, setItems] = useState<Experience[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Experience | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ data: Experience[] }>("/experiences");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await api<{ data: Experience[] }>("/experiences");
      if (active && res) setItems(res.data);
    })();
    return () => { active = false; };
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(exp: Experience) {
    setEditing(exp);
    setForm({
      company: exp.company,
      department: exp.department ?? "",
      title: exp.title,
      employmentType: exp.employmentType ?? "",
      startDate: fmtDate(exp.startDate),
      endDate: fmtDate(exp.endDate),
      location: exp.location ?? "",
      description: exp.description ?? "",
      highlights: exp.highlights.join("\n"),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.company || !form.title || !form.startDate) {
      toast.error(t("experience.requiredError"));
      return;
    }
    setSaving(true);
    const body = JSON.stringify({
      company: form.company,
      department: form.department || undefined,
      title: form.title,
      employmentType: form.employmentType || undefined,
      startDate: form.startDate,
      endDate: form.endDate || null,
      location: form.location || undefined,
      description: form.description || undefined,
      highlights: form.highlights.split("\n").map((s) => s.trim()).filter(Boolean),
    });
    const res = editing
      ? await api(`/experiences/${editing.id}`, { method: "PUT", body })
      : await api("/experiences", { method: "POST", body });
    setSaving(false);
    if (res) {
      toast.success(editing ? t("common.updated") : t("common.added"));
      setOpen(false);
      void load();
    }
  }

  async function remove(id: string) {
    const res = await api(`/experiences/${id}`, { method: "DELETE" });
    if (res) {
      toast.success(t("common.deleted"));
      void load();
    }
  }

  if (!items) {
    return <div className="space-y-3 pt-4">{[1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> {t("experience.add")}
        </Button>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("experience.empty")}
        </CardContent></Card>
      )}

      <div className="relative space-y-3 before:absolute before:inset-y-2 before:left-[7px] before:w-px before:bg-border">
        {items.map((exp) => (
          <div key={exp.id} className="relative pl-6">
            <span className="absolute left-0 top-5 size-[15px] rounded-full border-4 border-background bg-primary" />
            <Card>
              <CardContent className="space-y-2 py-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {exp.company}
                      {exp.department && <span className="ml-2 text-sm font-normal text-muted-foreground">{exp.department}</span>}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">{exp.title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fmtRange(exp.startDate, exp.endDate)}
                      {exp.location && ` · ${exp.location}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(exp)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="size-8">
                          <Trash2 className="size-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("experience.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {exp.projects.length > 0
                              ? t("experience.deleteWithProjects", { count: exp.projects.length })
                              : t("experience.deleteDesc")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(exp.id)}>{t("common.delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                {exp.highlights.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                    {exp.highlights.map((h, i) => <li key={i}>{h}</li>)}
                  </ul>
                )}
                {exp.projects.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {exp.projects.map((p) => (
                      <Badge key={p.id} variant="secondary" className="font-normal">{p.name}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? t("experience.editTitle") : t("experience.addTitle")}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>{t("experience.company")}</Label>
              <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("experience.department")}</Label>
              <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("experience.titleField")}</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("experience.startDate")}</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("experience.endDate")}</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("experience.type")}</Label>
                <Select value={form.employmentType} onValueChange={(v) => setForm({ ...form, employmentType: v })}>
                  <SelectTrigger><SelectValue placeholder={t("common.select")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fulltime">{t("experience.type.fulltime")}</SelectItem>
                    <SelectItem value="contract">{t("experience.type.contract")}</SelectItem>
                    <SelectItem value="intern">{t("experience.type.intern")}</SelectItem>
                    <SelectItem value="freelance">{t("experience.type.freelance")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("experience.location")}</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("experience.summary")}</Label>
              <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("experience.highlights")}</Label>
              <Textarea rows={4} value={form.highlights} onChange={(e) => setForm({ ...form, highlights: e.target.value })} />
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
