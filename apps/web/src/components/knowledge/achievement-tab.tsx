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
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Pencil, Plus, Trash2 } from "lucide-react";

type Achievement = {
  id: string;
  title: string;
  metricValue?: string | number | null;
  metricUnit?: string | null;
  metricText?: string | null;
  occurredAt?: string | null;
  experienceId?: string | null;
  projectId?: string | null;
  experience?: { id: string; company: string } | null;
  project?: { id: string; name: string } | null;
};

type Option = { id: string; label: string };
const NONE = "__none__";
const EMPTY_FORM = {
  title: "", metricValue: "", metricUnit: "", metricText: "",
  experienceId: NONE, projectId: NONE, occurredAt: "",
};

export function AchievementTab() {
  const [items, setItems] = useState<Achievement[] | null>(null);
  const [expOptions, setExpOptions] = useState<Option[]>([]);
  const [projOptions, setProjOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [achRes, expRes, projRes] = await Promise.all([
      api<{ data: Achievement[] }>("/achievements"),
      api<{ data: { id: string; company: string; title: string }[] }>("/experiences"),
      api<{ data: { id: string; name: string }[] }>("/projects"),
    ]);
    if (achRes) setItems(achRes.data);
    if (expRes) setExpOptions(expRes.data.map((e) => ({ id: e.id, label: `${e.company} · ${e.title}` })));
    if (projRes) setProjOptions(projRes.data.map((p) => ({ id: p.id, label: p.name })));
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(a: Achievement) {
    setEditing(a);
    setForm({
      title: a.title,
      metricValue: a.metricValue != null ? String(a.metricValue) : "",
      metricUnit: a.metricUnit ?? "",
      metricText: a.metricText ?? "",
      experienceId: a.experienceId ?? NONE,
      projectId: a.projectId ?? NONE,
      occurredAt: fmtDate(a.occurredAt),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.title) {
      toast.error("成果标题为必填");
      return;
    }
    setSaving(true);
    const body = JSON.stringify({
      title: form.title,
      metricValue: form.metricValue ? Number(form.metricValue) : null,
      metricUnit: form.metricUnit || null,
      metricText: form.metricText || null,
      experienceId: form.experienceId === NONE ? null : form.experienceId,
      projectId: form.projectId === NONE ? null : form.projectId,
      occurredAt: form.occurredAt || null,
    });
    const res = editing
      ? await api(`/achievements/${editing.id}`, { method: "PUT", body })
      : await api("/achievements", { method: "POST", body });
    setSaving(false);
    if (res) {
      toast.success(editing ? "已更新" : "已添加");
      setOpen(false);
      void load();
    }
  }

  async function remove(id: string) {
    const res = await api(`/achievements/${id}`, { method: "DELETE" });
    if (res) {
      toast.success("已删除");
      void load();
    }
  }

  if (!items) return <Skeleton className="mt-4 h-48" />;

  return (
    <div className="space-y-3 pt-2">
      <div className="flex justify-end">
        <Button size="sm" onClick={openCreate}><Plus className="size-4" /> 添加成果</Button>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          还没有量化成果。「增长30%」「管理20人团队」这类记录是简历说服力的核心。
        </CardContent></Card>
      ) : (
        <Card><CardContent className="px-0 py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>成果</TableHead>
                <TableHead className="w-28">指标</TableHead>
                <TableHead className="w-44">挂靠</TableHead>
                <TableHead className="w-28">时间</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.metricValue != null ? `${a.metricValue}${a.metricUnit ?? ""}` : a.metricText ?? "—"}
                  </TableCell>
                  <TableCell className="truncate text-sm text-muted-foreground">
                    {a.project?.name ?? a.experience?.company ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.occurredAt ? fmtDate(a.occurredAt).slice(0, 7) : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => openEdit(a)}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => remove(a.id)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader><SheetTitle>{editing ? "编辑成果" : "添加成果"}</SheetTitle></SheetHeader>
          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label>成果标题 *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="日本区收入增长" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>数值</Label>
                <Input type="number" value={form.metricValue} onChange={(e) => setForm({ ...form, metricValue: e.target.value })} placeholder="30" />
              </div>
              <div className="space-y-1.5">
                <Label>单位</Label>
                <Input value={form.metricUnit} onChange={(e) => setForm({ ...form, metricUnit: e.target.value })} placeholder="% / 人 / 万元" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>无法量化时的描述</Label>
              <Input value={form.metricText} onChange={(e) => setForm({ ...form, metricText: e.target.value })} placeholder="管理20人团队" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>挂靠经历</Label>
                <Select value={form.experienceId} onValueChange={(v) => setForm({ ...form, experienceId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>无</SelectItem>
                    {expOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>挂靠项目</Label>
                <Select value={form.projectId} onValueChange={(v) => setForm({ ...form, projectId: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>无</SelectItem>
                    {projOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>发生时间</Label>
              <Input type="date" value={form.occurredAt} onChange={(e) => setForm({ ...form, occurredAt: e.target.value })} />
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
