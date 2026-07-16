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

type Me = {
  name: string;
  email: string;
  locale: string;
  region?: string | null;
  jobStatus: "open" | "passive" | "closed";
  privacy: Record<string, boolean>;
};

const PRIVACY_ITEMS: { key: string; label: string; desc: string; soon?: boolean }[] = [
  { key: "profile_public", label: "公开职业主页", desc: "任何人可通过链接查看你的脱敏职业画像" },
  { key: "resume_searchable", label: "简历可被搜索", desc: "招聘者可在人才库中检索到你", soon: true },
  { key: "recruiter_contact", label: "接受招聘者联系", desc: "允许认证招聘者站内触达", soon: true },
  { key: "feed_visible", label: "职业动态可见", desc: "工作日志摘要生成的动态对关注者可见", soon: true },
];

export default function SettingsPage() {
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
      toast.success("已保存");
    }
  }

  if (!me) return <div className="mx-auto max-w-2xl space-y-4"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-semibold">设置</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账户</CardTitle>
          <CardDescription>{me.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>姓名</Label>
            <Input value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>界面语言</Label>
              <Select value={me.locale} onValueChange={(v) => setMe({ ...me, locale: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ja">日本語</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>所在地区</Label>
              <Input value={me.region ?? ""} onChange={(e) => setMe({ ...me, region: e.target.value })} placeholder="东京 / 上海" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>求职状态</Label>
            <Select value={me.jobStatus} onValueChange={(v) => setMe({ ...me, jobStatus: v as Me["jobStatus"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">看机会中</SelectItem>
                <SelectItem value="passive">观望</SelectItem>
                <SelectItem value="closed">不看机会</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={saving}
            onClick={() => save({ name: me.name, locale: me.locale, region: me.region, jobStatus: me.jobStatus })}
          >
            {saving ? "保存中…" : "保存"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">隐私</CardTitle>
          <CardDescription>你的数据默认全部私有，每一项开放都由你决定。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PRIVACY_ITEMS.map((item) => (
            <div key={item.key} className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">
                  {item.label}
                  {item.soon && <span className="ml-2 text-xs text-muted-foreground">（即将上线）</span>}
                </p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
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
