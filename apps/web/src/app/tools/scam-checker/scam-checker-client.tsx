"use client";

import { useState, useRef } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";

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

export function ScamCheckerClient() {
  const t = useT();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScamResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const riskLabel: Record<string, string> = {
    high: t("toolsPages.scam.sevHigh"),
    medium: t("toolsPages.scam.sevMedium"),
    low: t("toolsPages.scam.sevLow"),
    safe: t("toolsPages.scam.sevSafe"),
  };

  async function run() {
    if (text.trim().length < 10) {
      toast.error(t("toolsPages.scam.toastShort"));
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
        throw new Error(data?.error?.message ?? t("toolsPages.scam.toastFail"));
      }
      setResult(data as ScamResult);
    } catch (e) {
      // 用户主动取消：不弹错误，保留上次结果
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error(e instanceof Error ? e.message : t("toolsPages.scam.toastFail"));
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
        <h1 className="text-3xl font-bold tracking-tight">{t("toolsPages.scam.h1")}</h1>
        <p className="text-muted-foreground">{t("toolsPages.scam.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("toolsPages.scam.inputTitle")}</CardTitle>
          <CardDescription>{t("toolsPages.scam.inputDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("toolsPages.scam.inputPh")}
            className="min-h-44"
          />
          {loading ? (
            <div className="flex items-center gap-3">
              <Button disabled className="w-full sm:w-auto">
                <Loader2 className="size-4 animate-spin" />
                {t("toolsPages.scam.detecting")}
              </Button>
              <Button variant="outline" onClick={cancel} className="w-full sm:w-auto">
                {t("toolsPages.scam.cancel")}
              </Button>
            </div>
          ) : (
            <Button onClick={run} className="w-full sm:w-auto">
              {t("toolsPages.scam.start")}
            </Button>
          )}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.mock && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              {t("toolsPages.scam.demoMode")}
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
                  {t("toolsPages.scam.riskLevel")}
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
              <CardTitle className="text-lg">{t("toolsPages.scam.flags", { n: result.flags.length })}</CardTitle>
              <CardDescription>{t("toolsPages.scam.flagsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {result.flags.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("toolsPages.scam.noFlags")}</p>
              ) : (
                <ul className="space-y-3">
                  {result.flags.map((f, i) => (
                    <li key={i} className="rounded-lg border p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className={severityClass[f.severity]}>
                          {f.severity === "high"
                            ? t("toolsPages.scam.sevHigh")
                            : f.severity === "medium"
                              ? t("toolsPages.scam.sevMedium")
                              : t("toolsPages.scam.sevLow")}
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
