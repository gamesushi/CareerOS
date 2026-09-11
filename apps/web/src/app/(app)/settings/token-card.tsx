"use client";

import { useState } from "react";

type Price = {
  model: string;
  label: string;
  inPer1k: number;
  outPer1k: number;
  currency: string;
};

type Txn = {
  id: string;
  delta: number;
  kind: string;
  refType: string | null;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  consume: "消费",
  grant: "发放",
  deduct: "扣减",
};

// 设置页 Token 额度卡片：展示余额、档位、每日上限/已用、近期流水；价格表可展开。
export function TokenCard(props: {
  balance: number;
  tier: string;
  tierLabel: string;
  freeQuota: number;
  dailyCap: number;
  dailyUsed: number;
  dailyRemaining: number;
  prices: Price[];
  transactions: Txn[];
}) {
  const { balance, tierLabel, freeQuota, dailyCap, dailyUsed, dailyRemaining, prices, transactions } = props;
  const [showPrices, setShowPrices] = useState(false);

  const dailyPct = dailyCap > 0 ? Math.min(100, Math.round((dailyUsed / dailyCap) * 100)) : 0;
  const balPct = freeQuota > 0 ? Math.min(100, Math.round((balance / freeQuota) * 100)) : 0;

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">AI 用量额度（Token）</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            每消耗 1 个 AI token 扣 1 额度。C 端一次性赠送 {freeQuota.toLocaleString()}、B 端 100,000；每日上限次日 UTC 0 点重置。
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {tierLabel}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tabular-nums">{balance.toLocaleString()}</span>
          <span className="text-sm text-muted-foreground">剩余额度</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">免费额度 {freeQuota.toLocaleString()}</div>
      </div>

      {/* 余额进度（相对免费额度） */}
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>余额 / 免费额度</span>
          <span>{balPct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-sky-500" style={{ width: `${balPct}%` }} />
        </div>
      </div>

      {/* 每日上限进度 */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>今日已用 {dailyUsed.toLocaleString()} / 上限 {dailyCap.toLocaleString()}</span>
          <span>剩余 {dailyRemaining.toLocaleString()}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${dailyPct >= 100 ? "bg-amber-500" : "bg-emerald-500"}`}
            style={{ width: `${dailyPct}%` }}
          />
        </div>
      </div>

      {/* 价格表弹层 */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => setShowPrices((v) => !v)}
          className="text-sm font-medium text-sky-600 hover:underline"
        >
          {showPrices ? "收起模型价格" : "查看模型价格"}
        </button>
        {showPrices && (
          <div className="mt-2 overflow-x-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">模型</th>
                  <th className="px-3 py-2 text-right font-medium">输入 ¥/1K</th>
                  <th className="px-3 py-2 text-right font-medium">输出 ¥/1K</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p) => (
                  <tr key={p.model} className="border-t">
                    <td className="px-3 py-2">{p.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.inPer1k.toFixed(4)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{p.outPer1k.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 近期流水 */}
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">近期流水</h3>
        {transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">暂无记录</p>
        ) : (
          <ul className="divide-y rounded-md border text-sm">
            {transactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span
                  className={`tabular-nums font-medium ${t.delta < 0 ? "text-rose-600" : "text-emerald-600"}`}
                >
                  {t.delta > 0 ? "+" : ""}
                  {t.delta.toLocaleString()}
                </span>
                <span className="text-muted-foreground">{KIND_LABEL[t.kind] ?? t.kind}</span>
                <span className="max-w-[8rem] truncate text-xs text-muted-foreground">{t.note ?? t.refType ?? ""}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {new Date(t.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
