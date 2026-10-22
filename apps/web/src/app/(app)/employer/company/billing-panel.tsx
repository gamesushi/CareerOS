"use client";

// 组织订阅 / 账单面板。展示当前套餐状态，提供「订阅 Pro」「管理订阅」入口（跳 Stripe）。
// 仅 owner/admin 可发起订阅 / 进入 Portal；其余成员仅可查看状态。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CreditCard, CheckCircle2, AlertTriangle } from "lucide-react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Entitlement = {
  isSubscribed: boolean;
  status: string | null;
  plan: { slug: string; name: string; features: string[]; maxActivePostings: number } | null;
  maxActivePostings: number;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  trialing: "试用中",
  active: "生效中",
  past_due: "逾期（需更新支付方式）",
  canceled: "已取消",
  unpaid: "未支付",
  incomplete: "未完成",
  paused: "已暂停",
};

const PRO_FEATURES = [
  "最多 100 个同时在招岗位",
  "组织公开主页 / 公司品牌页",
  "候选人投递收件箱与状态管理",
  "优先审核通道",
];

const fmtDate = (d: string | null | undefined) => (d ? String(d).slice(0, 10) : "");

export function BillingPanel({
  orgId,
  canManage,
  billingNotice,
}: {
  orgId: string;
  canManage: boolean;
  billingNotice?: "success" | "cancel" | null;
}) {
  const router = useRouter();
  const [ent, setEnt] = useState<Entitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    api<Entitlement>(`/billing/subscription?orgId=${orgId}`).then((data) => {
      setEnt(data);
      setLoading(false);
    });
    // 处理 Stripe 回跳参数（由服务端 page 读取并透传，避免 useSearchParams 的 Suspense 要求）
    if (billingNotice === "success") toast.success("订阅成功，感谢支持 uCareerOS！");
    else if (billingNotice === "cancel") toast.info("已取消本次订阅操作");
    if (billingNotice) router.replace("/employer/company");
  }, [orgId, billingNotice, router]);

  async function goCheckout() {
    setActing(true);
    const data = await api<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ orgId, planSlug: "pro" }),
    });
    setActing(false);
    if (data?.url) window.location.href = data.url;
  }

  async function goPortal() {
    setActing(true);
    const data = await api<{ url: string }>("/billing/portal", {
      method: "POST",
      body: JSON.stringify({ orgId }),
    });
    setActing(false);
    if (data?.url) window.location.href = data.url;
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> 加载订阅信息…
        </CardContent>
      </Card>
    );
  }

  const subscribed = ent?.isSubscribed;

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">订阅与账单</h2>
            <p className="text-sm text-muted-foreground">解锁 Pro 招聘能力</p>
          </div>
          <StatusBadge ent={ent} />
        </div>

        {ent?.status === "past_due" && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertTriangle className="size-4" />
            订阅已逾期，请更新支付方式以继续使用 Pro 功能。
          </div>
        )}

        {subscribed ? (
          <div className="space-y-3">
            <div className="text-sm">
              当前会员：
              <span className="font-medium">{ent?.plan?.name ?? "Pro"}</span>
              {ent?.currentPeriodEnd && (
                <span className="text-muted-foreground"> · 到期 {fmtDate(ent.currentPeriodEnd)}</span>
              )}
              {ent?.cancelAtPeriodEnd && (
                <span className="text-muted-foreground">（已取消，周期末生效）</span>
              )}
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {(ent?.plan?.features ?? PRO_FEATURES).map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            {canManage && (
              <Button variant="outline" onClick={goPortal} disabled={acting}>
                {acting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                管理订阅 / 支付方式
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              免费版最多 {ent?.maxActivePostings ?? 5} 个在招岗位。升级 Pro 解锁更多在招岗与高级招聘功能。
            </p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
            {canManage ? (
              <Button onClick={goCheckout} disabled={acting}>
                {acting ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                订阅 Pro（月费）
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">仅组织所有者 / 管理员可管理订阅。</p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          支付由 Stripe 提供安全保障，结账与账单管理均在 Stripe 官方页面完成。
        </p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ ent }: { ent: Entitlement | null }) {
  if (!ent) return null;
  if (ent.isSubscribed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <CheckCircle2 className="size-3.5" /> {STATUS_LABEL[ent.status ?? ""] ?? ent.status ?? "会员"}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      免费版
    </span>
  );
}
