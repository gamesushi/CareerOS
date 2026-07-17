"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Target, CircleAlert } from "lucide-react";
import { Suspense } from "react";

type JdDetail = {
  id: string;
  company?: string | null;
  title?: string | null;
  status: string;
  rawContent: string;
  parsed?: {
    skills: { name: string; required: boolean; weight: number }[];
    experience: { desc: string; yearsMin?: number | null }[];
    industry: string[];
    keywords: string[];
    seniority?: string | null;
    location?: string | null;
  } | null;
  matches: { id: string; matchScore: string | number; createdAt: string; runId?: string | null }[];
};

type MatchDetail = {
  id: string;
  state: "computing" | "succeeded" | "failed";
  error?: string | null;
  matchScore: string | number;
  skillCoverage: string | number;
  experienceCoverage: string | number;
  industryCoverage: string | number;
  missingSkills: { name: string; required: boolean; suggestion: string }[];
  matchedEvidence: { jdItem: string; entityType: string; entityId: string; entityLabel: string; similarity: number }[];
  createdAt: string;
};

function JdDetailInner({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jd, setJd] = useState<JdDetail | null>(null);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [matchId, setMatchId] = useState<string | null>(searchParams.get("match"));

  const loadJd = useCallback(async () => {
    const res = await api<JdDetail>(`/jds/${id}`);
    if (res) {
      setJd(res);
      if (!matchId && res.matches[0]) setMatchId(res.matches[0].id);
    }
  }, [id, matchId]);

  useEffect(() => { void loadJd(); }, [loadJd]);

  // 匹配结果轮询（computing → succeeded/failed）
  useEffect(() => {
    if (!matchId) return;
    let stop = false;
    async function poll() {
      while (!stop) {
        const res = await api<MatchDetail>(`/matches/${matchId}`, { silent: true });
        if (!res) return;
        setMatch(res);
        if (res.state !== "computing") return;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    void poll();
    return () => { stop = true; };
  }, [matchId]);

  async function rematch() {
    const res = await api<{ matchId: string }>(`/jds/${id}/match`, { method: "POST" });
    if (res) {
      setMatch(null);
      setMatchId(res.matchId);
    }
  }

  if (!jd) return <div className="mx-auto max-w-5xl"><Skeleton className="h-64" /></div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">
            {[jd.company, jd.title].filter(Boolean).join(" · ") || "JD 详情"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {jd.parsed?.seniority && `职级 ${jd.parsed.seniority} · `}
            {jd.parsed?.location && `${jd.parsed.location} · `}
            历史匹配 {jd.matches.length} 次
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/jobs")}>返回</Button>
          <Button onClick={rematch}><Target className="size-4" /> 重新匹配</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左：JD 原文 + 解析标签 */}
        <div className="space-y-4">
          {jd.parsed && (
            <Card>
              <CardHeader><CardTitle className="text-base">解析出的要求</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {jd.parsed.skills.map((s) => (
                    <Badge key={s.name} variant={s.required ? "default" : "outline"} className="font-normal">
                      {s.name}
                      <span className="ml-1 opacity-60">w{s.weight}</span>
                    </Badge>
                  ))}
                </div>
                {jd.parsed.experience.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                    {jd.parsed.experience.map((e, i) => (
                      <li key={i}>{e.desc}{e.yearsMin ? `（≥${e.yearsMin} 年）` : ""}</li>
                    ))}
                  </ul>
                )}
                {jd.parsed.industry.length > 0 && (
                  <p className="text-xs text-muted-foreground">行业：{jd.parsed.industry.join(" / ")}</p>
                )}
              </CardContent>
            </Card>
          )}
          <Card className="max-h-[50vh] overflow-hidden py-0">
            <CardContent className="h-full overflow-y-auto px-4 py-4">
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                {jd.rawContent}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* 右：匹配报告 */}
        <div className="space-y-4">
          {!match && matchId && (
            <Card><CardContent className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="size-4 animate-spin" /><span className="text-sm">计算匹配中…</span>
            </CardContent></Card>
          )}
          {!matchId && (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              还没有匹配记录，点右上角「重新匹配」。
            </CardContent></Card>
          )}
          {match?.state === "computing" && (
            <Card><CardContent className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="size-4 animate-spin" /><span className="text-sm">正在补齐向量并打分…</span>
            </CardContent></Card>
          )}
          {match?.state === "failed" && (
            <Card><CardContent className="space-y-2 py-8 text-center">
              <CircleAlert className="mx-auto size-6 text-destructive" />
              <p className="text-sm text-muted-foreground">{match.error ?? "匹配失败"}</p>
            </CardContent></Card>
          )}
          {match?.state === "succeeded" && (
            <>
              <Card>
                <CardContent className="space-y-4 py-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">匹配总分</span>
                    <span className="text-4xl font-bold">{Number(match.matchScore).toFixed(0)}</span>
                  </div>
                  <ScoreRow label="技能覆盖（×0.5）" value={Number(match.skillCoverage)} />
                  <ScoreRow label="经历覆盖（×0.3）" value={Number(match.experienceCoverage)} />
                  <ScoreRow label="行业覆盖（×0.2）" value={Number(match.industryCoverage)} />
                  <p className="text-xs text-muted-foreground">
                    {new Date(match.createdAt).toLocaleString("zh-CN")} · 补充证据后可重新匹配对比分数变化
                  </p>
                </CardContent>
              </Card>

              {match.missingSkills.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">缺失技能（{match.missingSkills.length}）</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {match.missingSkills.map((s) => (
                      <div key={s.name} className="flex items-start gap-2 text-sm">
                        <Badge variant={s.required ? "destructive" : "outline"} className="shrink-0 font-normal">
                          {s.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{s.suggestion}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {match.matchedEvidence.length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-base">命中证据（{match.matchedEvidence.length}）</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {match.matchedEvidence.map((e, i) => (
                      <div key={i} className="rounded-md border p-2.5 text-sm">
                        <p className="text-xs text-muted-foreground">{e.jdItem}</p>
                        <p className="mt-0.5">
                          → {e.entityLabel || e.entityType}
                          <span className="ml-2 text-xs text-muted-foreground">
                            相似度 {(e.similarity * 100).toFixed(0)}%
                          </span>
                        </p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Button
                className="w-full"
                onClick={async () => {
                  const res = await api<{ resumeId: string }>("/resumes/generate", {
                    method: "POST",
                    body: JSON.stringify({ jdId: id, resumeType: "zh" }),
                  });
                  if (res) router.push(`/resumes/${res.resumeId}`);
                }}
              >
                基于此 JD 生成简历
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span>{value.toFixed(0)}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}

export default function JdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense>
      <JdDetailInner id={id} />
    </Suspense>
  );
}
