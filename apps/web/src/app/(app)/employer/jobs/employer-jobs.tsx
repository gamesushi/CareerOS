"use client";

// 雇主端：发布岗位表单。岗位管理已拆到 /employer/jobs/manage。

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import {
  POSTER_ROLES,
  COMPANY_STAGES,
  JOB_CATEGORIES,
  SUBCATEGORY_IDS_BY_PARENT,
} from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { type MyOrg } from "./components/types";

const EMPTY = {
  /** "" = 以个人名义发布；否则是某个组织的 id。 */
  orgId: "",
  posterRole: "hr" as (typeof POSTER_ROLES)[number]["id"],
  companyStage: "unregistered" as (typeof COMPANY_STAGES)[number]["id"],
  company: "",
  title: "",
  location: "",
  salary: "",
  description: "",
  url: "",
  referralCode: "",
  categories: [] as string[],
};

export function EmployerJobs() {
  const t = useT();
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [orgs, setOrgs] = useState<MyOrg[]>([]);

  useEffect(() => {
    void api<{ data: MyOrg[] }>("/organizations", { silent: true }).then((res) => {
      if (res) setOrgs(res.data);
    });
  }, []);

  const set =
    (k: "company" | "title" | "location" | "salary" | "description" | "url" | "referralCode") =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const toggleCategory = (id: string) =>
    setForm((f) => {
      const on = f.categories.includes(id);
      if (on) {
        // 取消一级品类时，连带清掉它名下的所有二级细分
        const subs = SUBCATEGORY_IDS_BY_PARENT[id] ?? [];
        return { ...f, categories: f.categories.filter((x) => x !== id && !subs.includes(x)) };
      }
      return { ...f, categories: [...f.categories, id] };
    });

  const toggleSub = (parentId: string, subId: string) =>
    setForm((f) => {
      const has = f.categories.includes(subId);
      if (has) {
        return { ...f, categories: f.categories.filter((x) => x !== subId) };
      }
      // 选中二级细分时，确保对应一级品类存在（便于候选端按一级筛选命中）
      return f.categories.includes(parentId)
        ? { ...f, categories: [...f.categories, subId] }
        : { ...f, categories: [...f.categories, parentId, subId] };
    });

  async function submit(status: "draft" | "open") {
    setSaving(true);
    const res = await api<{ id: string }>("/job-postings", {
      method: "POST",
      body: JSON.stringify({
        // 传了 orgId 时服务端会用组织名/类型覆盖下面两项，这里照常带上兜底
        orgId: form.orgId || undefined,
        posterRole: form.posterRole,
        companyStage: form.companyStage,
        company: form.company.trim(),
        title: form.title.trim(),
        location: form.location.trim() || undefined,
        salary: form.salary.trim() || undefined,
        description: form.description.trim(),
        url: form.url.trim() || undefined,
        referralCode: form.referralCode.trim() || undefined,
        categories: form.categories,
        status,
      }),
    });
    setSaving(false);
    if (res) {
      toast.success(status === "draft" ? t("employer.savedDraft") : t("employer.submitted"));
      setForm({ ...EMPTY });
    }
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

          <div className="space-y-1.5">
            <Label>{t("employer.field.posterRole")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {POSTER_ROLES.map((o) => {
                const on = form.posterRole === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, posterRole: o.id }))}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      on ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {t(`posterRole.${o.id}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("employer.field.companyStage")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {COMPANY_STAGES.map((o) => {
                const on = form.companyStage === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, companyStage: o.id }))}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      on ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {t(`companyStage.${o.id}`)}
                  </button>
                );
              })}
            </div>
          </div>

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

          <div className="space-y-2">
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
                    {t(`category.${c.id}`) ?? c.label}
                  </button>
                );
              })}
            </div>
            {/* 二级细分：选中一级后才出现，便于更精准地描述岗位 */}
            {JOB_CATEGORIES.filter((c) => form.categories.includes(c.id)).map((c) => (
              <div
                key={c.id}
                className="ml-1 flex flex-wrap items-center gap-1.5 border-l pl-3"
              >
                {c.subcategories.map((s) => {
                  const on = form.categories.includes(s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSub(c.id, s.id);
                      }}
                      className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                        on
                          ? "bg-primary text-primary-foreground ring-1 ring-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      {t(`category.${s.id}`) ?? s.label}
                    </button>
                  );
                })}
              </div>
            ))}
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

          <div className="space-y-1.5">
            <Label>{t("employer.field.referralCode")}</Label>
            <Input
              placeholder={t("employer.referralCodePlaceholder")}
              value={form.referralCode}
              onChange={set("referralCode")}
            />
            <p className="text-xs text-muted-foreground">{t("employer.referralCodeHint")}</p>
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
    </div>
  );
}
