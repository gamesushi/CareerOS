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
  careerProfile?: {
    headline?: string | null;
    summary?: string | null;
    personal?: PersonalRecord;
  } | null;
};

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
  const [personal, setPersonal] = useState<PersonalRecord>({});

  useEffect(() => {
    void api<Me>("/me").then((res) => {
      if (!res) return;
      setMe(res);
      setName(res.name ?? "");
      setMobile(res.mobile ?? "");
      setPreferredCity(res.preferredCity ?? "");
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
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold">{t("profile.title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.contact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.email")}</Label>
            <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
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
            <Label>{t("resumeDetail.position")}</Label>
            <Input value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder={t("profile.headlinePlaceholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.summary")}</Label>
            <Textarea rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>
          <Button disabled={saving} onClick={save}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.photoSection")}</CardTitle>
          <CardDescription>{t("profile.photoHint")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.photo")}</Label>
            <PhotoUploader
              value={personal.photo ?? undefined}
              onChange={(v) => setPersonal((p) => ({ ...p, photo: v ?? null }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("resumeDetail.address")}</Label>
            <Input
              value={personal.address ?? ""}
              onChange={(e) => setPersonal((p) => ({ ...p, address: e.target.value || null }))}
              placeholder={t("profile.addressPlaceholder")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile.japanese")}</CardTitle>
          <CardDescription>{t("profile.japaneseDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.furigana")}</Label>
              <Input value={personal.furigana ?? ""} onChange={(e) => setPersonal((p) => ({ ...p, furigana: e.target.value || null }))} placeholder="やまだ たろう" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("resumeDetail.birthDate")}</Label>
              <Input type="date" value={personal.birthDate ?? ""} onChange={(e) => setPersonal((p) => ({ ...p, birthDate: e.target.value || null }))} />
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
