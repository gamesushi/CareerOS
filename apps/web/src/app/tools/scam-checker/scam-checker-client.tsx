"use client";

import { useState, useRef } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type ScamFlag = { type: string; severity: "high" | "medium" | "low"; detail: string };
type ScamResult = {
  riskLevel: "high" | "medium" | "low" | "safe";
  summary: string;
  flags: ScamFlag[];
  mock?: boolean;
};

const severityClass: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
};

const riskClass: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300",
  medium: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300",
  low: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
  safe: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
};

const riskLabel: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
  safe: "暂无明显红旗",
};

export function ScamCheckerClient() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScamResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (text.trim().length < 10) {
      toast.error("请粘贴更完整的招聘文案（至少 10 字）");
      return;
    }
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const res = await fetch("/api/tools/scam-checker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: ac.signal,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message ?? "检测失败，请稍后重试");
      }
      setResult(data as ScamResult);
    } catch (e) {
      // 用户主动取消：不弹错误，保留上次结果
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : "检测失败");
    } finally {
      if (abortRef.current === ac) abortRef.current = null;
      setLoading(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">幽灵岗 / 诈骗招聘检测</h1>
        <p className="text-muted-foreground">
          粘贴招聘文案，AI 识别入职押金、培训贷、刷单垫付等红旗并给出风险等级。
          文本仅用于本次分析，不会留存。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">招聘文案</CardTitle>
          <CardDescription>粘贴完整的岗位描述 / 聊天记录</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例如：诚聘客服专员，日薪 800 起，入职需先交 200 元服装费，添加微信 xxx 办理培训分期…"
            className="min-h-44"
          />
          {loading ? (
            <div className="flex items-center gap-3">
              <Button disabled className="w-full sm:w-auto">
                <Loader2 className="size-4 animate-spin" />
                检测中…
              </Button>
              <Button variant="outline" onClick={cancel} className="w-full sm:w-auto">
                取消
              </Button>
            </div>
          ) : (
            <Button onClick={run} className="w-full sm:w-auto">
              开始检测
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.mock && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              演示模式：当前未配置 AI Key，展示的是模拟结果。配置 DEEPSEEK_API_KEY 后即为真实分析。
            </div>
          )}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  {result.riskLevel === "safe" ? (
                    <ShieldCheck className="size-5 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="size-5 text-red-600" />
                  )}
                  风险等级
                </CardTitle>
                <Badge variant="outline" className={riskClass[result.riskLevel]}>
                  {riskLabel[result.riskLevel]}
                </Badge>
              </div>
              <CardDescription>{result.summary}</CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">红旗清单（{result.flags.length}）</CardTitle>
              <CardDescription>按严重程度从高到低排列</CardDescription>
            </CardHeader>
            <CardContent>
              {result.flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">未发现明显红旗，但仍建议通过官方渠道核实公司资质。</p>
              ) : (
                <ul className="space-y-3">
                  {result.flags.map((f, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className={severityClass[f.severity]}>
                          {f.severity === "high" ? "高危" : f.severity === "medium" ? "中危" : "低危"}
                        </Badge>
                        <span className="font-medium">{f.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{f.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
