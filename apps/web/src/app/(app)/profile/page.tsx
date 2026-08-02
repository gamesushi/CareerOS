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
import { useT } from "@/lib/i18n/provider";
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

const emptyLangData: ProfileLangData = {
  name: "",
  headline: "",
  summary: "",
  preferredCity: "",
  mobile: "",
  address: "",
};

export default function ProfilePage() {
  const t = useT();
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
      toast.error("请先填写中文基本资料（姓名、头衔或简介）");
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
      toast.success("✨ 已成功通过 AI 自动生成英文与日文档案！请在对应标签页核对。");
    } catch {
      toast.error("AI 翻译失败，请稍后重试");
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
          <p className="mt-0.5 text-sm text-muted-foreground">
            设置您的共享个人信息与多语言（中文 / English / 日本語）专属档案。切换简历样式时将自动调用对应语言资料。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleAiTranslate}
          disabled={translating}
          className="gap-1.5 border-amber-500/40 bg-amber-500/5 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
        >
          {translating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4 text-amber-500" />}
          AI 一键翻译多语言档案
        </Button>
      </div>

      <Tabs defaultValue="zh">
        <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 gap-2">
          <TabsTrigger value="zh" className="data-[state=active]:bg-muted px-4 py-2">
            🇨🇳 中文档案 (ZH)
          </TabsTrigger>
          <TabsTrigger value="en" className="data-[state=active]:bg-muted px-4 py-2">
            🇺🇸 English Profile (EN)
          </TabsTrigger>
          <TabsTrigger value="ja" className="data-[state=active]:bg-muted px-4 py-2">
            🇯🇵 日本語プロフィール (JA)
          </TabsTrigger>
        </TabsList>

        {/* ==================== 🇨🇳 中文档案 ==================== */}
        <TabsContent value="zh" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">中文基础资料</CardTitle>
              <CardDescription>生成 / 预览中文版简历（经典 / 现代 / 侧栏 / 紧凑等样式）时自动调用</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>中文姓名</Label>
                  <Input value={zhData.name ?? ""} onChange={(e) => setZhData((d) => ({ ...d, name: e.target.value }))} placeholder="如：何北航" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("resumeDetail.email")}</Label>
                  <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>联系电话</Label>
                  <Input value={zhData.mobile ?? ""} onChange={(e) => setZhData((d) => ({ ...d, mobile: e.target.value }))} placeholder="13800000000" />
                </div>
                <div className="space-y-1.5">
                  <Label>意向 / 居住城市</Label>
                  <Input value={zhData.preferredCity ?? ""} onChange={(e) => setZhData((d) => ({ ...d, preferredCity: e.target.value }))} placeholder="北京 / 上海 / 深圳" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>详细地址</Label>
                <Input value={zhData.address ?? ""} onChange={(e) => setZhData((d) => ({ ...d, address: e.target.value }))} placeholder="北京市朝阳区…" />
              </div>
              <div className="space-y-1.5">
                <Label>职业头衔 / Headline</Label>
                <Input value={zhData.headline ?? ""} onChange={(e) => setZhData((d) => ({ ...d, headline: e.target.value }))} placeholder="如：海外游戏发行专家 / 全栈工程师" />
              </div>
              <div className="space-y-1.5">
                <Label>个人简介 / Summary</Label>
                <Textarea rows={3} value={zhData.summary ?? ""} onChange={(e) => setZhData((d) => ({ ...d, summary: e.target.value }))} placeholder="9年+互联网·游戏行业经验，精通日本市场用户研究…" />
              </div>

              {/* 中文标签页 — 证件照（可选） */}
              <Separator />
              <div className="space-y-1.5">
                <Label>证件照（可选）</Label>
                <p className="text-xs text-muted-foreground">若上传，支持照片的模板会自动渲染；清空后所有简历同步隐藏。</p>
                <PhotoUploader
                  value={photo ?? undefined}
                  onChange={(v) => setPhoto(v ?? null)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 🇺🇸 English Profile ==================== */}
        <TabsContent value="en" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="size-4 text-blue-500" />
                English Profile
              </CardTitle>
              <CardDescription>Automatically applied when using the ATS English template or exporting US-style resumes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Full Name</Label>
                  <Input value={enData.name ?? ""} onChange={(e) => setEnData((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. Beihang He" />
                </div>
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Phone Number</Label>
                  <Input value={enData.mobile ?? ""} onChange={(e) => setEnData((d) => ({ ...d, mobile: e.target.value }))} placeholder="+81 80-9619-4237" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target / Current City</Label>
                  <Input value={enData.preferredCity ?? ""} onChange={(e) => setEnData((d) => ({ ...d, preferredCity: e.target.value }))} placeholder="Tokyo, Japan / San Jose, CA" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Input value={enData.address ?? ""} onChange={(e) => setEnData((d) => ({ ...d, address: e.target.value }))} placeholder="San Jose, CA 95110" />
              </div>
              <div className="space-y-1.5">
                <Label>Professional Title / Headline</Label>
                <Input value={enData.headline ?? ""} onChange={(e) => setEnData((d) => ({ ...d, headline: e.target.value }))} placeholder="e.g. Japan Market Content & Growth Strategist" />
              </div>
              <div className="space-y-1.5">
                <Label>Professional Summary</Label>
                <Textarea rows={3} value={enData.summary ?? ""} onChange={(e) => setEnData((d) => ({ ...d, summary: e.target.value }))} placeholder="Senior strategist with 9+ years of experience in gaming & internet industry..." />
              </div>

              {/* 英文标签页 — 签证状态 */}
              <Separator />
              <div className="space-y-1.5">
                <Label>Work Authorization / Visa Status</Label>
                <p className="text-xs text-muted-foreground">US employers typically require work authorization disclosure. Leave blank if not applying to US positions.</p>
                <Select value={workAuth} onValueChange={setWorkAuth}>
                  <SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={WORK_AUTH_NONE}>Not specified</SelectItem>
                    <SelectItem value="us_authorized">Authorized to work (Citizen / Green Card / H1B)</SelectItem>
                    <SelectItem value="requires_sponsorship">Requires visa sponsorship</SelectItem>
                    <SelectItem value="other">Other / N/A</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== 🇯🇵 日本語プロフィール ==================== */}
        <TabsContent value="ja" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="size-4 text-red-500" />
                日本語プロフィール
              </CardTitle>
              <CardDescription>選択したテンプレートが「職務経歴書」や「履歴書」の場合、右側のプレビューや出力で自動適用されます</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>氏名</Label>
                  <Input value={jaData.name ?? ""} onChange={(e) => setJaData((d) => ({ ...d, name: e.target.value }))} placeholder="例：何 北航" />
                </div>
                <div className="space-y-1.5">
                  <Label>E-mail</Label>
                  <Input value={me.email} readOnly disabled className="bg-muted/50 text-muted-foreground" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>電話番号</Label>
                  <Input value={jaData.mobile ?? ""} onChange={(e) => setJaData((d) => ({ ...d, mobile: e.target.value }))} placeholder="080-9619-4237" />
                </div>
                <div className="space-y-1.5">
                  <Label>希望勤務地 / 現住所都市</Label>
                  <Input value={jaData.preferredCity ?? ""} onChange={(e) => setJaData((d) => ({ ...d, preferredCity: e.target.value }))} placeholder="東京" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>現住所</Label>
                <Input value={jaData.address ?? ""} onChange={(e) => setJaData((d) => ({ ...d, address: e.target.value }))} placeholder="東京都渋谷区1-2-3" />
              </div>
              <div className="space-y-1.5">
                <Label>職種・肩書 / Headline</Label>
                <Input value={jaData.headline ?? ""} onChange={(e) => setJaData((d) => ({ ...d, headline: e.target.value }))} placeholder="例：日本市場コンテンツ＆成長戦略家" />
              </div>
              <div className="space-y-1.5">
                <Label>職務要約・自己PR / Summary</Label>
                <Textarea rows={3} value={jaData.summary ?? ""} onChange={(e) => setJaData((d) => ({ ...d, summary: e.target.value }))} placeholder="インターネット・ゲーム業界で9年以上の経験を持ち、日本市場のユーザーリサーチ…" />
              </div>

              {/* 日文标签页 — 履歴書専用 */}
              <Separator />
              <div className="space-y-1.5">
                <Label>証明写真（履歴書用）</Label>
                <p className="text-xs text-muted-foreground">日本の履歴書では写真欄が必須です（40mm×30mm）。削除するとすべての履歴書プレビューで写真が非表示になります。</p>
                <PhotoUploader
                  value={photo ?? undefined}
                  onChange={(v) => setPhoto(v ?? null)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ふりがな</Label>
                  <p className="text-xs text-muted-foreground">履歴書の氏名欄の上にふりがなを表示します</p>
                  <Input
                    value={furigana}
                    onChange={(e) => setFurigana(e.target.value)}
                    placeholder="やまだ たろう"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>生年月日</Label>
                  <p className="text-xs text-muted-foreground">履歴書に出生年月日を記載します（年齢は自動計算）</p>
                  <Input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
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