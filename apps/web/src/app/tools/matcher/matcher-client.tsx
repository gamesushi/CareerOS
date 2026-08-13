"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";

// 英文停用词：匹配时噪音大、对岗位相关性无意义，予以过滤。
const EN_STOPWORDS = new Set([
  "the", "and", "for", "with", "you", "our", "are", "but", "not", "has", "have", "will", "all",
  "can", "per", "via", "from", "into", "your", "who", "out", "on", "in", "of", "to", "a", "an",
  "or", "is", "as", "at", "by", "be", "we", "this", "that", "their", "they", "job", "work",
  "team", "new", "more", "than", "other", "such", "any", "how", "what", "when", "where", "which",
  "about", "after", "before", "off", "up", "down", "over", "under", "between", "will", "all",
]);

// 提取关键词：英文取词（去停用词），中文按 2 字滑动窗口取 bigram（重叠匹配、对局部命中更敏感）。
function extractKeywords(text: string): string[] {
  const keywords: string[] = [];
  const en = text.toLowerCase().match(/[a-z0-9]+(?:[.\-][a-z0-9]+)*/g) ?? [];
  for (const w of en) {
    if (w.length < 2) continue;
    if (EN_STOPWORDS.has(w)) continue;
    keywords.push(w);
  }
  const cjkRuns = text.match(/[一-鿿]+/g) ?? [];
  for (const run of cjkRuns) {
    if (run.length === 1) {
      keywords.push(run);
    } else {
      for (let i = 0; i < run.length - 1; i++) keywords.push(run.slice(i, i + 2));
    }
  }
  return keywords;
}

type Level = "Strong" | "Partial" | "Weak";

function analyze(resume: string, jd: string) {
  const resumeSet = new Set(extractKeywords(resume));
  const jdKeywords = extractKeywords(jd);
  const uniqueJd = Array.from(new Set(jdKeywords));
  const matched = uniqueJd.filter((k) => resumeSet.has(k));
  const missing = uniqueJd.filter((k) => !resumeSet.has(k));
  const score = uniqueJd.length ? matched.length / uniqueJd.length : 0;
  const pct = Math.round(score * 100);
  let level: Level;
  if (pct >= 75) level = "Strong";
  else if (pct >= 45) level = "Partial";
  else level = "Weak";
  return { pct, level, matched, missing, jdCount: uniqueJd.length, resumeCount: resumeSet.size };
}

// 将 JD 切成片段，标记每个片段是否被简历命中，用于高亮渲染（避免嵌套 span）。
function buildSegments(jd: string, resumeSet: Set<string>) {
  const regex = /([a-z0-9]+(?:[.\-][a-z0-9]+)*)|([一-鿿]+)|([^a-z0-9一-鿿]+)/gi;
  const out: { text: string; matched: boolean }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(jd)) !== null) {
    if (m.index > last) out.push({ text: jd.slice(last, m.index), matched: false });
    const [full, en, cjk] = m;
    if (en) {
      out.push({ text: full, matched: resumeSet.has(full.toLowerCase()) });
    } else if (cjk) {
      let matched = false;
      if (cjk.length === 1) matched = resumeSet.has(cjk);
      else {
        for (let i = 0; i < cjk.length - 1; i++) {
          if (resumeSet.has(cjk.slice(i, i + 2))) {
            matched = true;
            break;
          }
        }
      }
      out.push({ text: full, matched });
    } else {
      out.push({ text: full, matched: false });
    }
    last = m.index + full.length;
  }
  if (last < jd.length) out.push({ text: jd.slice(last), matched: false });
  return out;
}

const levelClass: Record<Level, string> = {
  Strong: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300",
  Partial: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300",
  Weak: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300",
};

export function MatcherClient() {
  const t = useT();
  const [resume, setResume] = useState("");
  const [jd, setJd] = useState("");

  const levelText: Record<Level, string> = {
    Strong: t("toolsPages.matcher.strong"),
    Partial: t("toolsPages.matcher.partial"),
    Weak: t("toolsPages.matcher.weak"),
  };

  const result = useMemo(() => {
    if (resume.trim().length < 5 || jd.trim().length < 5) return null;
    const a = analyze(resume, jd);
    const segments = buildSegments(jd, new Set(extractKeywords(resume)));
    return { ...a, segments };
  }, [resume, jd]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("toolsPages.matcher.h1")}</h1>
        <p className="text-muted-foreground">{t("toolsPages.matcher.subtitle")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("toolsPages.matcher.yourResume")}</CardTitle>
            <CardDescription>{t("toolsPages.matcher.yourResumeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={resume}
              onChange={(e) => setResume(e.target.value)}
              placeholder={t("toolsPages.matcher.yourResumePh")}
              className="min-h-56"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("toolsPages.matcher.jd")}</CardTitle>
            <CardDescription>{t("toolsPages.matcher.jdDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder={t("toolsPages.matcher.jdPh")}
              className="min-h-56"
            />
          </CardContent>
        </Card>
      </div>

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg">{t("toolsPages.matcher.result")}</CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold tabular-nums">{result.pct}%</span>
                  <Badge variant="outline" className={levelClass[result.level]}>
                    {levelText[result.level]}
                  </Badge>
                </div>
              </div>
              <CardDescription>
                {t("toolsPages.matcher.resultDesc", {
                  jd: result.jdCount,
                  matched: result.matched.length,
                  resume: result.resumeCount,
                })}
              </CardDescription>
            </CardHeader>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("toolsPages.matcher.matched")}</CardTitle>
                <CardDescription className="text-emerald-600 dark:text-emerald-400">
                  {t("toolsPages.matcher.matchedDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.matched.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("toolsPages.matcher.matchedEmpty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {result.matched.map((k) => (
                      <Badge key={k} variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {k}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t("toolsPages.matcher.missing")}</CardTitle>
                <CardDescription className="text-rose-600 dark:text-rose-400">
                  {t("toolsPages.matcher.missingDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {result.missing.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("toolsPages.matcher.missingEmpty")}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {result.missing.map((k) => (
                      <Badge key={k} variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                        {k}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("toolsPages.matcher.highlight")}</CardTitle>
              <CardDescription>{t("toolsPages.matcher.highlightDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap break-words leading-relaxed">
                {result.segments.map((s, i) =>
                  s.matched ? (
                    <mark
                      key={i}
                      className="rounded bg-emerald-100 px-0.5 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    >
                      {s.text}
                    </mark>
                  ) : (
                    <span key={i}>{s.text}</span>
                  ),
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
