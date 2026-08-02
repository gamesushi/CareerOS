"use client";

// 公司资料：没有组织时是创建表单，有则是编辑表单 + 公开主页链接。
// 首期一人一组织（UI 层面），表结构已支持多组织多成员，等 Phase 3 做成员邀请再放开。

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { ORG_TYPES, ORG_SIZES, slugify } from "@careeros/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ExternalLink, Image as ImageIcon, Loader2, Upload } from "lucide-react";
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

export function CompanyForm({ initial }: { initial: Org | null }) {
  const t = useT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    slug: initial?.slug ?? "",
    orgType: (initial?.orgType ?? "startup") as (typeof ORG_TYPES)[number]["id"],
    website: initial?.website ?? "",
    description: initial?.description ?? "",
    industry: initial?.industry ?? "",
    size: initial?.size ?? "",
    location: initial?.location ?? "",
  });
  // slug 只在用户没手动改过时跟随组织名自动生成，避免覆盖用户的选择
  const [slugTouched, setSlugTouched] = useState(!!initial);

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

  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const v = e.target.value;
      setForm((f) => ({
        ...f,
        [k]: v,
        ...(k === "name" && !slugTouched ? { slug: slugify(v) } : {}),
      }));
    };

  async function save() {
    setSaving(true);
    const body = {
      name: form.name.trim(),
      slug: form.slug.trim() || undefined,
      orgType: form.orgType,
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

      {initial && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex flex-wrap items-center gap-2 py-3 text-sm">
            <span className="text-muted-foreground">{t("company.publicPage")}</span>
            <Link
              href={`/c/${initial.slug}`}
              target="_blank"
              className="font-medium text-primary hover:underline"
            >
              /c/{initial.slug} <ExternalLink className="inline size-3" />
            </Link>
            {initial.verified && <Badge variant="secondary">{t("company.verified")}</Badge>}
            <Badge variant="outline" className="ml-auto">
              {t(`company.role.${initial.myRole}`)}
            </Badge>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label>{t("employer.field.orgType")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {ORG_TYPES.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, orgType: o.id }))}
                  className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                    form.orgType === o.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  {t(`orgType.${o.id}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("company.field.name")} *</Label>
              <Input value={form.name} onChange={set("name")} placeholder={t("company.namePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("company.field.slug")}</Label>
              <Input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug")(e);
                }}
                placeholder="acme-tech"
              />
              <p className="text-xs text-muted-foreground">{t("company.slugHint")}</p>
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
