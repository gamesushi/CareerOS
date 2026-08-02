"use client";

// 雇主端：发布岗位 + 管理「我的发布」。posting-only —— 不含候选人搜索与团队协作。

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { ORG_TYPES, JOB_CATEGORIES } from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Loader2, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type MyOrg = { id: string; slug: string; name: string; orgType: string };

type Posting = {
  id: string;
  orgType: string;
  company: string;
  org?: { slug: string; name: string } | null;
  title: string;
  location?: string | null;
  salary?: string | null;
  description: string;
  url?: string | null;
  categories?: string[] | null;
  status: "draft" | "open" | "closed";
  reviewStatus: "pending" | "approved" | "rejected";
  reviewNote?: string | null;
  takenDownAt?: string | null;
  createdAt: string;
};

const EMPTY = {
  /** "" = 以个人名义发布；否则是某个组织的 id。 */
  orgId: "",
  orgType: "startup" as (typeof ORG_TYPES)[number]["id"],
  company: "",
  title: "",
  location: "",
  salary: "",
  description: "",
  url: "",
  categories: [] as string[],
};

export function EmployerJobs() {
  const t = useT();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<Posting[] | null>(null);
  const [orgs, setOrgs] = useState<MyOrg[]>([]);

  const load = useCallback(async () => {
    const [postings, myOrgs] = await Promise.all([
      api<{ data: Posting[] }>("/job-postings"),
      api<{ data: MyOrg[] }>("/organizations", { silent: true }),
    ]);
    if (postings) setItems(postings.data);
    if (myOrgs) setOrgs(myOrgs.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set =
    (k: "company" | "title" | "location" | "salary" | "description" | "url") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleCategory = (id: string) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(id)
        ? f.categories.filter((x) => x !== id)
        : [...f.categories, id],
    }));

  async function submit(status: "draft" | "open") {
    setSaving(true);
    const res = await api<{ id: string }>("/job-postings", {
      method: "POST",
      body: JSON.stringify({
        // 传了 orgId 时服务端会用组织名/类型覆盖下面两项，这里照常带上兜底
        orgId: form.orgId || undefined,
        orgType: form.orgType,
        company: form.company.trim(),
        title: form.title.trim(),
        location: form.location.trim() || undefined,
        salary: form.salary.trim() || undefined,
        description: form.description.trim(),
        url: form.url.trim() || undefined,
        categories: form.categories,
        status,
      }),
    });
    setSaving(false);
    if (res) {
      toast.success(status === "draft" ? t("employer.savedDraft") : t("employer.submitted"));
      setForm({ ...EMPTY });
      void load();
    }
  }

  async function changeStatus(p: Posting, status: "draft" | "open" | "closed") {
    const res = await api(`/job-postings/${p.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (res) void load();
  }

  async function remove(p: Posting) {
    if (!window.confirm(t("employer.confirmDelete"))) return;
    const res = await api(`/job-postings/${p.id}`, { method: "DELETE" });
    if (res) void load();
  }

  const valid =
    form.company.trim().length >= 2 &&
    form.title.trim().length >= 2 &&
    form.description.trim().length >= 30;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("employer.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("employer.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          {/* 有组织时先选「以谁的名义发布」；选了组织就锁定公司名与主体类型，
              避免同一组织的不同岗写出不同公司名，把公司主页拆散。 */}
          {orgs.length > 0 && (
            <div className="space-y-1.5">
              <Label>{t("employer.field.postAs")}</Label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, orgId: "" }))}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    !form.orgId ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {t("employer.postAsSelf")}
                </button>
                {orgs.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        orgId: o.id,
                        company: o.name,
                        orgType: o.orgType as (typeof ORG_TYPES)[number]["id"],
                      }))
                    }
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      form.orgId === o.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!form.orgId && (
            <div className="space-y-1.5">
              <Label>{t("employer.field.orgType")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ORG_TYPES.map((o) => {
                  const on = form.orgType === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, orgType: o.id }))}
                      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                        on ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                      }`}
                    >
                      {t(`orgType.${o.id}`)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("employer.field.company")} *</Label>
              <Input
                placeholder={t("employer.companyPlaceholder")}
                value={form.company}
                onChange={set("company")}
                disabled={!!form.orgId}
              />
              {form.orgId && (
                <p className="text-xs text-muted-foreground">{t("employer.companyLocked")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>{t("employer.field.title")} *</Label>
              <Input
                placeholder={t("employer.titlePlaceholder")}
                value={form.title}
                onChange={set("title")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("employer.field.location")}</Label>
              <Input value={form.location} onChange={set("location")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("employer.field.salary")}</Label>
              <Input
                placeholder={t("employer.salaryPlaceholder")}
                value={form.salary}
                onChange={set("salary")}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("employer.field.categories")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {JOB_CATEGORIES.map((c) => {
                const on = form.categories.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCategory(c.id)}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      on ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {t(`category.${c.id}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("employer.field.description")} *</Label>
            <Textarea
              rows={7}
              placeholder={t("employer.descriptionPlaceholder")}
              value={form.description}
              onChange={set("description")}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("employer.field.url")}</Label>
            <Input placeholder="https://…" value={form.url} onChange={set("url")} />
            <p className="text-xs text-muted-foreground">{t("employer.urlHint")}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button disabled={saving || !valid} onClick={() => submit("open")}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("employer.publish")}
            </Button>
            <Button variant="outline" disabled={saving || !valid} onClick={() => submit("draft")}>
              {t("employer.saveDraft")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("employer.reviewHint")}</span>
          </div>
          {!valid && (form.title || form.company || form.description) && (
            <p className="text-xs text-muted-foreground">{t("employer.invalidHint")}</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">{t("employer.myPostings")}</h2>
        {!items && <Skeleton className="h-24" />}
        {items?.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">{t("employer.empty")}</p>
        )}
        {items?.map((p) => (
          <Card key={p.id}>
            <CardContent className="space-y-2 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.title}</span>
                {p.org ? (
                  <a
                    href={`/c/${p.org.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {p.company}
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">{p.company}</span>
                )}
                {p.location && <span className="text-xs text-muted-foreground">{p.location}</span>}
                {p.salary && <span className="text-xs text-muted-foreground">{p.salary}</span>}
                <StatusBadges posting={p} t={t} />
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>

              {p.reviewStatus === "rejected" && p.reviewNote && (
                <p className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">
                  {t("employer.rejectedNote", { note: p.reviewNote })}
                </p>
              )}

              <div className="flex items-center gap-1.5">
                {p.status !== "open" && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(p, "open")}>
                    {p.status === "draft" ? t("employer.publish") : t("employer.reopen")}
                  </Button>
                )}
                {p.status === "open" && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(p, "closed")}>
                    {t("employer.close")}
                  </Button>
                )}
                {p.status === "draft" && (
                  <Button size="sm" variant="ghost" onClick={() => remove(p)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

/** 状态徽标：发布状态（草稿/在招/已下架）+ 审核状态 + 管理员下架。 */
function StatusBadges({
  posting: p,
  t,
}: {
  posting: Posting;
  t: (k: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <>
      <Badge variant={p.status === "open" ? "default" : "secondary"}>
        {t(`employer.status.${p.status}`)}
      </Badge>
      {p.takenDownAt ? (
        <Badge variant="destructive">{t("employer.takenDown")}</Badge>
      ) : (
        p.status !== "draft" && (
          <Badge
            variant={p.reviewStatus === "approved" ? "outline" : "secondary"}
            className={p.reviewStatus === "rejected" ? "text-destructive" : ""}
          >
            {t(`employer.review.${p.reviewStatus}`)}
          </Badge>
        )
      )}
    </>
  );
}
