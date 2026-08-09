"use client";

// 公司资料：前期定位为「我的公司信息档案」，不创建公开主页、不填写主页地址，
// 主页能力（/c/<slug>）留到未来。公司名支持从已抓取记录一键导入。
// 首期一人一组织（UI 层面），表结构已支持多组织多成员，等 Phase 3 做成员邀请再放开。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { ORG_SIZES, slugify } from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Image as ImageIcon, Loader2, Upload, ChevronDown, Building2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";

type Org = {
  id: string;
  slug: string;
  name: string;
  orgType: string;
  logoUrl?: string | null;
  website?: string | null;
  description?: string | null;
  industry?: string | null;
  size?: string | null;
  location?: string | null;
  verified: boolean;
  myRole: string;
};

export function CompanyForm({
  initial,
  existingCompanies,
}: {
  initial: Org | null;
  existingCompanies: string[];
}) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    website: initial?.website ?? "",
    description: initial?.description ?? "",
    industry: initial?.industry ?? "",
    size: initial?.size ?? "",
    location: initial?.location ?? "",
  });

  // 已抓取公司下拉
  const [showCompanies, setShowCompanies] = useState(false);
  const [companyFilter, setCompanyFilter] = useState("");
  const filteredCompanies = companyFilter.trim()
    ? existingCompanies.filter((c) => c.toLowerCase().includes(companyFilter.toLowerCase()))
    : existingCompanies.slice(0, 8);

  // Logo 单独走上传接口（不随表单一起提交）：文件要 multipart，且要能单独删除
  const [logoUrl, setLogoUrl] = useState(initial?.logoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  // 换图后 URL 不变（按 org id），加个版本号强制刷新 <img> 缓存
  const [logoVersion, setLogoVersion] = useState(0);

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允许重复选同一个文件
    if (!file || !initial) return;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/v1/organizations/${initial.id}/logo`, { method: "POST", body });
    setUploading(false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json?.error?.message ?? t("company.logoFailed"));
      return;
    }
    setLogoUrl(json.logoUrl);
    setLogoVersion((v) => v + 1);
    toast.success(t("company.logoUploaded"));
    router.refresh();
  }

  async function removeLogo() {
    if (!initial) return;
    const res = await api(`/organizations/${initial.id}/logo`, { method: "DELETE" });
    if (res) {
      setLogoUrl(null);
      toast.success(t("company.logoRemoved"));
      router.refresh();
    }
  }

  const setName = (name: string) => {
    setForm((f) => ({ ...f, name })); // 不再自动衍生 slug（前期不创建主页）
    setCompanyFilter(name);
  };

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      if (k === "name") {
        setName(v);
        return;
      }
      setForm((f) => ({ ...f, [k]: v }));
    };

  function selectExisting(company: string) {
    setName(company);
    setShowCompanies(false);
  }

  async function save() {
    setSaving(true);
    const body = {
      name: form.name.trim(),
      website: form.website.trim() || undefined,
      description: form.description.trim() || undefined,
      industry: form.industry.trim() || undefined,
      size: form.size || undefined,
      location: form.location.trim() || undefined,
    };
    const res = initial
      ? await api<{ slug: string }>(`/organizations/${initial.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      : await api<{ slug: string }>("/organizations", {
          method: "POST",
          body: JSON.stringify(body),
        });
    setSaving(false);
    if (res) {
      toast.success(initial ? t("company.saved") : t("company.created"));
      router.refresh();
    }
  }

  const valid = form.name.trim().length >= 2;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("company.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("company.subtitle")}</p>
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t("company.field.name")} *</Label>
                {existingCompanies.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCompanies((s) => !s)}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
                  >
                    <ChevronDown className="size-3.5" />
                    {t("company.importButton")}
                  </button>
                )}
              </div>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={form.name}
                  onChange={set("name")}
                  onFocus={() => setShowCompanies(!!existingCompanies.length)}
                  onBlur={() => setTimeout(() => setShowCompanies(false), 150)}
                  placeholder={t("company.namePlaceholder")}
                  className="pl-9"
                />
                {showCompanies && existingCompanies.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                    <div className="max-h-56 overflow-auto p-1">
                      {filteredCompanies.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          {t("company.noExistingCompany")}
                        </div>
                      )}
                      {filteredCompanies.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectExisting(c);
                          }}
                          className="w-full rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{t("company.importHint")}</p>
            </div>

            <div className="space-y-1.5">
              <Label>{t("company.field.industry")}</Label>
              <Input value={form.industry} onChange={set("industry")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("company.field.location")}</Label>
              <Input value={form.location} onChange={set("location")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("company.field.size")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {ORG_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, size: f.size === s ? "" : s }))}
                    className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                      form.size === s ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("company.field.website")}</Label>
              <Input value={form.website} onChange={set("website")} placeholder="https://…" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("company.field.logo")}</Label>
            {initial ? (
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 自托管/外链皆有，不走 next/image loader
                  <img
                    src={`${logoUrl}?v=${logoVersion}`}
                    alt=""
                    className="size-14 rounded-md border object-contain"
                  />
                ) : (
                  <div className="flex size-14 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                    <ImageIcon className="size-5" />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent">
                    <Upload className="size-3.5" />
                    {uploading ? t("company.logoUploading") : t("company.logoUpload")}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={uploadLogo}
                    />
                  </label>
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={removeLogo}
                      className="text-left text-xs text-muted-foreground hover:text-destructive"
                    >
                      {t("company.logoRemove")}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{t("company.logoAfterCreate")}</p>
            )}
            <p className="text-xs text-muted-foreground">{t("company.logoHint")}</p>
          </div>

          <div className="space-y-1.5">
            <Label>{t("company.field.description")}</Label>
            <Textarea
              rows={5}
              value={form.description}
              onChange={set("description")}
              placeholder={t("company.descriptionPlaceholder")}
            />
          </div>

          <Button disabled={saving || !valid} onClick={save}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {initial ? t("company.save") : t("company.create")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
