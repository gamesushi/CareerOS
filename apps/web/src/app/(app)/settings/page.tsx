"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

type SnsLink = { network: string; url: string };
type LangEntry = { name: string; proficiency?: string };
type Me = {
  name: string;
  email: string;
  locale: string;
  region?: string | null;
  mobile?: string | null;
  preferredCity?: string | null;
  workAuthStatus?: "us_authorized" | "requires_sponsorship" | "other" | null;
  snsLinks?: SnsLink[];
  languages?: LangEntry[];
  jobStatus: "open" | "passive" | "closed";
  privacy: Record<string, boolean>;
};

const PRIVACY_ITEMS: { key: string; labelKey: string; descKey: string; soon?: boolean }[] = [
  { key: "profile_public", labelKey: "settings.privacy.profilePublic", descKey: "settings.privacy.profilePublicDesc" },
  { key: "resume_searchable", labelKey: "settings.privacy.resumeSearchable", descKey: "settings.privacy.resumeSearchableDesc", soon: true },
  { key: "recruiter_contact", labelKey: "settings.privacy.recruiterContact", descKey: "settings.privacy.recruiterContactDesc", soon: true },
  { key: "feed_visible", labelKey: "settings.privacy.feedVisible", descKey: "settings.privacy.feedVisibleDesc", soon: true },
];

const AUTH_NONE = "__none__";

export default function SettingsPage() {
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void api<Me>("/me").then((res) => res && setMe(res));
  }, []);

  async function save(patch: Partial<Me> & { privacy?: Record<string, boolean> }) {
    setSaving(true);
    const res = await api<Me>("/me", { method: "PUT", body: JSON.stringify(patch) });
    setSaving(false);
    if (res) {
      setMe(res);
      toast.success(t("common.saved"));
    }
  }

  if (!me) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;

  const sns = me.snsLinks ?? [];
  const langs = me.languages ?? [];

  function setSns(next: SnsLink[]) {
    setMe({ ...me!, snsLinks: next });
  }
  function setLangs(next: LangEntry[]) {
    setMe({ ...me!, languages: next });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold">{t("settings.title")}</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.account")}</CardTitle>
          <CardDescription>{me.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("settings.name")}</Label>
            <Input value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("settings.language")}</Label>
              <LocaleSwitcher className="w-full" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.region")}</Label>
              <Input value={me.region ?? ""} onChange={(e) => setMe({ ...me, region: e.target.value })} placeholder={t("settings.regionPlaceholder")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("settings.mobile")}</Label>
              <Input value={me.mobile ?? ""} onChange={(e) => setMe({ ...me, mobile: e.target.value })} placeholder="080-9619-4237" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("settings.preferredCity")}</Label>
              <Input value={me.preferredCity ?? ""} onChange={(e) => setMe({ ...me, preferredCity: e.target.value })} placeholder="San Jose / 东京" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.jobStatus")}</Label>
            <Select value={me.jobStatus} onValueChange={(v) => setMe({ ...me, jobStatus: v as Me["jobStatus"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">{t("settings.jobStatus.open")}</SelectItem>
                <SelectItem value="passive">{t("settings.jobStatus.passive")}</SelectItem>
                <SelectItem value="closed">{t("settings.jobStatus.closed")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.workAuth")}</Label>
            <Select
              value={me.workAuthStatus ?? AUTH_NONE}
              onValueChange={(v) => setMe({ ...me, workAuthStatus: v === AUTH_NONE ? null : (v as Me["workAuthStatus"]) })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={AUTH_NONE}>{t("settings.workAuth.none")}</SelectItem>
                <SelectItem value="us_authorized">{t("settings.workAuth.usAuthorized")}</SelectItem>
                <SelectItem value="requires_sponsorship">{t("settings.workAuth.requiresSponsorship")}</SelectItem>
                <SelectItem value="other">{t("settings.workAuth.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={saving}
            onClick={() => save({
              name: me.name, region: me.region, jobStatus: me.jobStatus,
              mobile: me.mobile || null, preferredCity: me.preferredCity || null,
              workAuthStatus: me.workAuthStatus ?? null,
            })}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.contact")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>{t("settings.snsLinks")}</Label>
            {sns.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  className="w-32 shrink-0"
                  value={s.network}
                  placeholder={t("settings.snsNetwork")}
                  onChange={(e) => { const n = [...sns]; n[i] = { ...n[i], network: e.target.value }; setSns(n); }}
                />
                <Input
                  className="flex-1"
                  value={s.url}
                  placeholder={t("settings.snsUrl")}
                  onChange={(e) => { const n = [...sns]; n[i] = { ...n[i], url: e.target.value }; setSns(n); }}
                />
                <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => setSns(sns.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSns([...sns, { network: "", url: "" }])}>
              <Plus className="size-4" /> {t("settings.addLink")}
            </Button>
          </div>

          <div className="space-y-2">
            <Label>{t("settings.languages")}</Label>
            {langs.map((l, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  className="w-40 shrink-0"
                  value={l.name}
                  placeholder={t("settings.langName")}
                  onChange={(e) => { const n = [...langs]; n[i] = { ...n[i], name: e.target.value }; setLangs(n); }}
                />
                <Input
                  className="flex-1"
                  value={l.proficiency ?? ""}
                  placeholder={t("settings.langProficiency")}
                  onChange={(e) => { const n = [...langs]; n[i] = { ...n[i], proficiency: e.target.value }; setLangs(n); }}
                />
                <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => setLangs(langs.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLangs([...langs, { name: "", proficiency: "" }])}>
              <Plus className="size-4" /> {t("common.add")}
            </Button>
          </div>

          <Button
            disabled={saving}
            onClick={() => save({
              snsLinks: sns.filter((s) => s.network.trim() && s.url.trim()),
              languages: langs.filter((l) => l.name.trim()).map((l) => ({ name: l.name, proficiency: l.proficiency || undefined })),
            })}
          >
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.privacy")}</CardTitle>
          <CardDescription>{t("settings.privacyDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PRIVACY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {t(item.labelKey)}
                  {item.soon && <span className="ml-2 text-xs text-muted-foreground">{t("common.soon")}</span>}
                </p>
                <p className="text-xs text-muted-foreground">{t(item.descKey)}</p>
              </div>
              <Switch
                checked={me.privacy[item.key] ?? false}
                disabled={item.soon}
                onCheckedChange={(checked) => save({ privacy: { [item.key]: checked } })}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
