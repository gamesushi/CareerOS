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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PhotoUploader } from "@/components/photo-uploader";
import { useT, useLocale } from "@/lib/i18n/provider";
import { Sparkles, Loader2, Globe } from "lucide-react";
import type { ProfileLangData, PersonalRecord } from "@/lib/merge-personal";

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
const LANG_ORDER = ["zh", "en", "ja"] as const;

const emptyLangData: ProfileLangData = {
  name: "",
  headline: "",
  summary: "",
  preferredCity: "",
  mobile: "",
  address: "",
};

function langFromLocale(locale: string): "zh" | "en" | "ja" {
  if (locale.startsWith("zh")) return "zh";
  if (locale.startsWith("ja")) return "ja";
  if (locale.startsWith("en")) return "en";
  return "zh";
}

export default function ProfilePage() {
  const t = useT();
  const locale = useLocale();
  const userLang = langFromLocale(locale);
  const orderedLangs = [userLang, ...LANG_ORDER.filter((l) => l !== userLang)];
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);

  // 通用字段：照片全局共享（各标签页可选是否上传）
  const [photo, setPhoto] = useState<string | null>(null);

  // 日文标签页专属
  const [furigana, setFurigana] = useState<string>("");
  const [birthDate, setBirthDate] = useState<string>("");

  // 英文标签页专属
  const [workAuth, setWorkAuth] = useState<string>(WORK_AUTH_NONE);

  // 多语言标签页编辑态 (zh / en / ja)
  const [zhData, setZhData] = useState<ProfileLangData>(emptyLangData);
  const [enData, setEnData] = useState<ProfileLangData>(emptyLangData);
  const [jaData, setJaData] = useState<ProfileLangData>(emptyLangData);

  useEffect(() => {
    void api<Me>("/me").then((res) => {
      if (!res) return;
      setMe(res);
      setWorkAuth(res.workAuthStatus ?? WORK_AUTH_NONE);
      const cp = res.careerProfile ?? null;
      const p = (cp?.personal ?? {}) as PersonalRecord;

      setPhoto(p.photo ?? null);
      setFurigana(p.furigana ?? "");
      setBirthDate(p.birthDate ?? "");

      setZhData({
        name: p.zh?.name ?? res.name ?? "",
        mobile: p.zh?.mobile ?? res.mobile ?? "",
        preferredCity: p.zh?.preferredCity ?? res.preferredCity ?? "",
        headline: p.zh?.headline ?? cp?.headline ?? "",
        summary: p.zh?.summary ?? cp?.summary ?? "",
        address: p.zh?.address ?? p.address ?? "",
      });

      setEnData({
        name: p.en?.name ?? "",
        mobile: p.en?.mobile ?? res.mobile ?? "",
        preferredCity: p.en?.preferredCity ?? "",
        headline: p.en?.headline ?? "",
        summary: p.en?.summary ?? "",
        address: p.en?.address ?? "",
      });

      setJaData({
        name: p.ja?.name ?? "",
        mobile: p.ja?.mobile ?? res.mobile ?? "",
        preferredCity: p.ja?.preferredCity ?? "",
        headline: p.ja?.headline ?? "",
        summary: p.ja?.summary ?? "",
        address: p.ja?.address ?? "",
      });
    });
  }, []);

  const handleAiTranslate = async () => {
    if (!zhData.headline && !zhData.summary && !zhData.name) {
      toast.error(t("profile.aiTranslateEmpty"));
      return;
    }
    setTranslating(true);
    try {
      const res = await api<{ en?: ProfileLangData; ja?: ProfileLangData }>("/profile/translate", {
        method: "POST",
        body: JSON.stringify(zhData),
      });
      if (res?.en) {
        setEnData((prev) => ({
          ...prev,
          name: res.en?.name || prev.name || "",
          headline: res.en?.headline || prev.headline || "",
          summary: res.en?.summary || prev.summary || "",
          preferredCity: res.en?.preferredCity || prev.preferredCity || "",
          address: res.en?.address || prev.address || "",
        }));
      }
      if (res?.ja) {
        setJaData((prev) => ({
          ...prev,
          name: res.ja?.name || prev.name || "",
          headline: res.ja?.headline || prev.headline || "",
          summary: res.ja?.summary || prev.summary || "",
          preferredCity: res.ja?.preferredCity || prev.preferredCity || "",
          address: res.ja?.address || prev.address || "",
        }));
      }
      toast.success(t("profile.aiTranslateSuccess"));
    } catch {
      toast.error(t("profile.aiTranslateError"));
    } finally {
      setTranslating(false);
    }
  };

  async function save() {
    setSaving(true);
    const res = await api<Me>("/me", {
      method: "PUT",
      body: JSON.stringify({
        name: zhData.name || me?.name || "",
        mobile: zhData.mobile || null,
        preferredCity: zhData.preferredCity || null,
        headline: zhData.headline || null,
        summary: zhData.summary || null,
        workAuthStatus: workAuth === WORK_AUTH_NONE ? null : workAuth,
        personal: {
          photo: photo ?? undefined,
          address: zhData.address || undefined,
          furigana: furigana || undefined,
          birthDate: birthDate || undefined,
          zh: zhData,
          en: enData,
          ja: jaData,
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("profile.title")}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{t("profile.subtitle")}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAiTranslate}
          disabled={translating}
          className="gap-1.5 border-amber-500/40 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
        >
          {translating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-amber-500" />}
          {t("profile.aiTranslate")}
        </Button>
      </div>

      <Tabs defaultValue={orderedLangs[0]}>
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 gap-2">
          {orderedLangs.map((lang) => (
            <TabsTrigger key={lang} value={lang} className="data-[state=active]:bg-muted px-4 py-2">
              {t(`profile.tab.${lang}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ==================== 中文档案 ==================== */}
        <TabsContent value="zh" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("profile.section.zhTitle")}</CardTitle>
              <CardDescription>{t("profile.section.zhDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.name")}</Label>
                  <Input value={zhData.name ?? ""} onChange={(e) => setZhData((d) => ({ ...d, name: e.target.value }))} placeholder={t("profile.placeholder.name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.email")}</Label>
                  <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.phone")}</Label>
                  <Input value={zhData.mobile ?? ""} onChange={(e) => setZhData((d) => ({ ...d, mobile: e.target.value }))} placeholder={t("profile.placeholder.phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.city")}</Label>
                  <Input value={zhData.preferredCity ?? ""} onChange={(e) => setZhData((d) => ({ ...d, preferredCity: e.target.value }))} placeholder={t("profile.placeholder.city")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.address")}</Label>
                <Input value={zhData.address ?? ""} onChange={(e) => setZhData((d) => ({ ...d, address: e.target.value }))} placeholder={t("profile.placeholder.address")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.headline")}</Label>
                <Input value={zhData.headline ?? ""} onChange={(e) => setZhData((d) => ({ ...d, headline: e.target.value }))} placeholder={t("profile.placeholder.headline")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.summary")}</Label>
                <Textarea rows={3} value={zhData.summary ?? ""} onChange={(e) => setZhData((d) => ({ ...d, summary: e.target.value }))} placeholder={t("profile.placeholder.summary")} />
              </div>

              <Separator />
              <div className="space-y-1.5">
                <Label>{t("profile.label.photo")}</Label>
                <p className="text-xs text-muted-foreground">{t("profile.label.photoHint")}</p>
                <PhotoUploader value={photo ?? undefined} onChange={(v) => setPhoto(v ?? null)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== English Profile ==================== */}
        <TabsContent value="en" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="size-4 text-blue-500" />
                {t("profile.section.enTitle")}
              </CardTitle>
              <CardDescription>{t("profile.section.enDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.name")}</Label>
                  <Input value={enData.name ?? ""} onChange={(e) => setEnData((d) => ({ ...d, name: e.target.value }))} placeholder={t("profile.placeholder.name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.email")}</Label>
                  <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.phone")}</Label>
                  <Input value={enData.mobile ?? ""} onChange={(e) => setEnData((d) => ({ ...d, mobile: e.target.value }))} placeholder={t("profile.placeholder.phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.city")}</Label>
                  <Input value={enData.preferredCity ?? ""} onChange={(e) => setEnData((d) => ({ ...d, preferredCity: e.target.value }))} placeholder={t("profile.placeholder.city")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.address")}</Label>
                <Input value={enData.address ?? ""} onChange={(e) => setEnData((d) => ({ ...d, address: e.target.value }))} placeholder={t("profile.placeholder.address")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.headline")}</Label>
                <Input value={enData.headline ?? ""} onChange={(e) => setEnData((d) => ({ ...d, headline: e.target.value }))} placeholder={t("profile.placeholder.headline")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.summary")}</Label>
                <Textarea rows={3} value={enData.summary ?? ""} onChange={(e) => setEnData((d) => ({ ...d, summary: e.target.value }))} placeholder={t("profile.placeholder.summary")} />
              </div>

              <Separator />
              <div className="space-y-1.5">
                <Label>{t("profile.label.workAuth")}</Label>
                <p className="text-xs text-muted-foreground">{t("profile.label.workAuthHint")}</p>
                <Select value={workAuth} onValueChange={setWorkAuth}>
                  <SelectTrigger><SelectValue placeholder={t("profile.workAuth.notSpecified")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WORK_AUTH_NONE}>{t("profile.workAuth.notSpecified")}</SelectItem>
                    <SelectItem value="us_authorized">{t("profile.workAuth.usAuthorized")}</SelectItem>
                    <SelectItem value="requires_sponsorship">{t("profile.workAuth.requiresSponsorship")}</SelectItem>
                    <SelectItem value="other">{t("profile.workAuth.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 日本語プロフィール ==================== */}
        <TabsContent value="ja" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="size-4 text-red-500" />
                {t("profile.section.jaTitle")}
              </CardTitle>
              <CardDescription>{t("profile.section.jaDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.name")}</Label>
                  <Input value={jaData.name ?? ""} onChange={(e) => setJaData((d) => ({ ...d, name: e.target.value }))} placeholder={t("profile.placeholder.name")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.email")}</Label>
                  <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.phone")}</Label>
                  <Input value={jaData.mobile ?? ""} onChange={(e) => setJaData((d) => ({ ...d, mobile: e.target.value }))} placeholder={t("profile.placeholder.phone")} />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.city")}</Label>
                  <Input value={jaData.preferredCity ?? ""} onChange={(e) => setJaData((d) => ({ ...d, preferredCity: e.target.value }))} placeholder={t("profile.placeholder.city")} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.address")}</Label>
                <Input value={jaData.address ?? ""} onChange={(e) => setJaData((d) => ({ ...d, address: e.target.value }))} placeholder={t("profile.placeholder.address")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.headline")}</Label>
                <Input value={jaData.headline ?? ""} onChange={(e) => setJaData((d) => ({ ...d, headline: e.target.value }))} placeholder={t("profile.placeholder.headline")} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("profile.label.summary")}</Label>
                <Textarea rows={3} value={jaData.summary ?? ""} onChange={(e) => setJaData((d) => ({ ...d, summary: e.target.value }))} placeholder={t("profile.placeholder.summary")} />
              </div>

              <Separator />
              <div className="space-y-1.5">
                <Label>{t("profile.label.photo")}</Label>
                <p className="text-xs text-muted-foreground">{t("profile.label.photoHint")}</p>
                <PhotoUploader value={photo ?? undefined} onChange={(v) => setPhoto(v ?? null)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{t("profile.label.furigana")}</Label>
                  <p className="text-xs text-muted-foreground">{t("profile.label.furiganaHint")}</p>
                  <Input value={furigana} onChange={(e) => setFurigana(e.target.value)} placeholder="やまだ たろう" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("profile.label.birthDate")}</Label>
                  <p className="text-xs text-muted-foreground">{t("profile.label.birthDateHint")}</p>
                  <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <Button disabled={saving} onClick={save} className="w-full">
        {saving ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );
}
