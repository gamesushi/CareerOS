"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PhotoUploader } from "@/components/photo-uploader";
import { useT } from "@/lib/i18n/provider";

type PersonalRecord = {
  photo?: string | null;
  address?: string | null;
  furigana?: string | null;
  birthDate?: string | null;
};

type Me = {
  name: string;
  email: string;
  mobile?: string | null;
  preferredCity?: string | null;
  region?: string | null;
  headline?: string | null;
  summary?: string | null;
  workAuthStatus?: "us_authorized" | "requires_sponsorship" | "other" | null;
  careerProfile?: {
    headline?: string | null;
    summary?: string | null;
    personal?: PersonalRecord;
  } | null;
};

const WORK_AUTH_NONE = "__none__";

export default function ProfilePage() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);

  // 本地编辑态（独立于 me，便于保存后回写）
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [preferredCity, setPreferredCity] = useState("");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [workAuth, setWorkAuth] = useState<string>(WORK_AUTH_NONE);
  const [personal, setPersonal] = useState<PersonalRecord>({});

  useEffect(() => {
    void api<Me>("/me").then((res) => {
      if (!res) return;
      setMe(res);
      setName(res.name ?? "");
      setMobile(res.mobile ?? "");
      setPreferredCity(res.preferredCity ?? "");
      setWorkAuth(res.workAuthStatus ?? WORK_AUTH_NONE);
      const cp = res.careerProfile ?? null;
      setHeadline(cp?.headline ?? "");
      setSummary(cp?.summary ?? "");
      setPersonal({
        photo: cp?.personal?.photo ?? null,
        address: cp?.personal?.address ?? null,
        furigana: cp?.personal?.furigana ?? null,
        birthDate: cp?.personal?.birthDate ?? null,
      });
    });
  }, []);

  async function save() {
    setSaving(true);
    const res = await api<Me>("/me", {
      method: "PUT",
      body: JSON.stringify({
        name,
        mobile: mobile || null,
        preferredCity: preferredCity || null,
        headline: headline || null,
        summary: summary || null,
        workAuthStatus: workAuth === WORK_AUTH_NONE ? null : workAuth,
        personal: {
          photo: personal.photo ?? undefined,
          address: personal.address || undefined,
          furigana: personal.furigana || undefined,
          birthDate: personal.birthDate || undefined,
        },
      }),
    });
    setSaving(false);
    if (res) {
      setMe(res);
      toast.success(t("common.saved"));
    }
  }

  if (!me) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("profile.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.contact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.email")}</Label>
              <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.phone")}</Label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="080-9619-4237" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.location")}</Label>
              <Input value={preferredCity} onChange={(e) => setPreferredCity(e.target.value)} placeholder="东京 / San Jose" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.address")}</Label>
            <Input
              value={personal.address ?? ""}
              onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value || null }))}
              placeholder={t("profile.addressPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.position")}</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t("profile.headlinePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.summary")}</Label>
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>工作许可 / 签证状态</Label>
            <p className="text-xs text-muted-foreground">美国简历通常需要注明工作许可状态；如不投美可忽略</p>
            <Select value={workAuth} onValueChange={setWorkAuth}>
              <SelectTrigger><SelectValue placeholder="未填" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={WORK_AUTH_NONE}>未填</SelectItem>
                <SelectItem value="us_authorized">无需签证支持（公民 / 绿卡 / 已有 H1B 等）</SelectItem>
                <SelectItem value="requires_sponsorship">需要签证支持</SelectItem>
                <SelectItem value="other">其他 / 不适用</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">日本履历书个人信息（可选）</CardTitle>
          <CardDescription>以下字段在日本履歴書中通常需要，但不是必填；不投日本可忽略</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>证件照</Label>
            <p className="text-xs text-muted-foreground">日本履歴書需要在照片框贴上证件照（中文 / 英文简历不需要照片）</p>
            <PhotoUploader
              value={personal.photo ?? undefined}
              onChange={(v) => setPersonal((p) => ({ ...p, photo: v ?? null }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.furigana")}</Label>
              <p className="text-xs text-muted-foreground">日本履歴書需要在姓名旁标注假名读音</p>
              <Input
                value={personal.furigana ?? ""}
                onChange={(e) => setPersonal((p) => ({ ...p, furigana: e.target.value || null }))}
                placeholder="やまだ たろう"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.birthDate")}</Label>
              <p className="text-xs text-muted-foreground">日本履歴書需要出生年月日（年龄由系统计算）</p>
              <Input
                type="date"
                value={personal.birthDate ?? ""}
                onChange={(e) => setPersonal((p) => ({ ...p, birthDate: e.target.value || null }))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />
      <Button disabled={saving} onClick={save} className="w-full">
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}