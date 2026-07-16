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
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";

type Education = {
  id: string;
  school: string;
  degree?: string | null;
  major?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  gpa?: string | null;
};

const EMPTY_FORM = { school: "", degree: "", major: "", startDate: "", endDate: "", gpa: "" };

export function EducationTab() {
  const [items, setItems] = useState<Education[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Education | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await api<{ data: Education[] }>("/educations");
    if (res) setItems(res.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(e: Education) {
    setEditing(e);
    setForm({
      school: e.school,
      degree: e.degree ?? "",
      major: e.major ?? "",
      startDate: fmtDate(e.startDate),
      endDate: fmtDate(e.endDate),
      gpa: e.gpa ?? "",
    });
    setOpen(true);
  }

  async function save() {
    if (!form.school) {
      toast.error("学校为必填");
      return;
    }
    setSaving(true);
    const body = JSON.stringify({
      school: form.school,
      degree: form.degree || undefined,
      major: form.major || undefined,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      gpa: form.gpa || undefined,
    });
    const res = editing
      ? await api(`/educations/${editing.id}`, { method: "PUT", body })
      : await api("/educations", { method: "POST", body });
    setSaving(false);
    if (res) {
      toast.success(editing ? "已更新" : "已添加");
      setOpen(false);
      void load();
    }
  }

  async function remove(id: string) {
    const res = await api(`/educations/${id}`, { method: "DELETE" });
    if (res) {
      toast.success("已删除");
      void load();
    }
  }

  if (!items) return <Skeleton className="mt-4 h-32" />;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="size-4" /> 添加教育经历</Button>
      </div>

      {items.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          还没有教育经历。
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {items.map((e) => (
          <Card key={e.id}>
            <CardContent className="flex items-center gap-3 py-4">
              <GraduationCap className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{e.school}</p>
                <p className="text-xs text-muted-foreground">
                  {[e.degree, e.major].filter(Boolean).join(" · ")}
                  {e.startDate && ` · ${fmtDate(e.startDate).slice(0, 4)} ~ ${e.endDate ? fmtDate(e.endDate).slice(0, 4) : "至今"}`}
                  {e.gpa && ` · GPA ${e.gpa}`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(e)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => remove(e.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "编辑教育经历" : "添加教育经历"}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>学校 *</Label>
              <Input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>学位</Label>
                <Input value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="本科 / 修士" />
              </div>
              <div className="space-y-1.5">
                <Label>专业</Label>
                <Input value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>入学</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>毕业</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>GPA</Label>
              <Input value={form.gpa} onChange={(e) => setForm({ ...form, gpa: e.target.value })} />
            </div>
          </div>
          <SheetFooter>
            <Button onClick={save} disabled={saving}>{saving ? "保存中…" : "保存"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
