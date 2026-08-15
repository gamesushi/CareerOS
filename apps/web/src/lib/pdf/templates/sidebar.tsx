import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFonts } from "../fonts";
import { range, titlesFor, type TemplateProps } from "../common";
import { resolveTheme, themedStyles } from "../theme";

// sidebar：参考 Reactive Resume「Azurill」布局思路的原创实现——
// 居中 header + 左侧栏（联系/技能/教育/成果）+ 右主栏（综述/经历/项目），
// 经历带 accent 色时间线圆点装饰。

const DEFAULT_ACCENT = "#0f766e";

export function SidebarTemplate({ resume, lang = "zh", accent = DEFAULT_ACCENT }: TemplateProps) {
  ensureFonts();
  const t = titlesFor(lang);
  const b = resume.basics;
  const th = resolveTheme(resume);

  const s = themedStyles({
    page: { fontFamily: "NotoSansSC", fontSize: 9.5, lineHeight: 1.5, color: "#1f1f1f", padding: 38 },
    header: { alignItems: "center", marginBottom: 14 },
    name: { fontSize: 21, fontWeight: 700, lineHeight: 1.2 },
    label: { fontSize: 10.5, color: "#555", marginTop: 2 },
    row: { flexDirection: "row", columnGap: 18 },
    side: { width: "32%" },
    main: { flex: 1 },
    sectionTitle: { fontSize: 10.5, fontWeight: 700, color: accent, marginBottom: 5, marginTop: 12 },
    sideItem: { fontSize: 8.8, color: "#333", marginBottom: 3 },
    sideMeta: { fontSize: 8, color: "#777" },
    skillName: { fontSize: 9, fontWeight: 700 },
    skillBarBg: { height: 3, backgroundColor: "#e5e5e5", borderRadius: 2, marginTop: 2, marginBottom: 6 },
    skillBar: { height: 3, backgroundColor: accent, borderRadius: 2 },
    summary: { color: "#333", marginBottom: 4 },
    // 时间线
    tlItem: { flexDirection: "row", marginBottom: 8 },
    tlMarker: { width: 14, alignItems: "center" },
    tlDot: {
      width: 7, height: 7, marginTop: 4, borderRadius: 4,
      borderWidth: 1.2, borderColor: accent, backgroundColor: "#fff",
    },
    tlLine: { flex: 1, width: 1, backgroundColor: accent, opacity: 0.35, marginTop: 2 },
    tlContent: { flex: 1 },
    entryHead: { flexDirection: "row", justifyContent: "space-between" },
    entryTitle: { fontWeight: 700, fontSize: 10 },
    entryMeta: { color: "#777", fontSize: 8.5 },
    entrySub: { color: "#444", fontSize: 9, marginTop: 1 },
    bullet: { flexDirection: "row", marginTop: 2 },
  }, th);

  const levelPct = (level?: string) => {
    const n = Number(level);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.min(n, 100);
  };

  const Timeline = ({
    entries,
  }: {
    entries: { title: string; meta: string; sub?: string; highlights: string[]; tail?: string }[];
  }) => (
    <>
      {entries.map((e, i) => (
        <View key={i} style={s.tlItem} wrap={false}>
          <View style={s.tlMarker}>
            <View style={s.tlDot} />
            {i < entries.length - 1 ? <View style={s.tlLine} /> : null}
          </View>
          <View style={s.tlContent}>
            <View style={s.entryHead}>
              <Text style={s.entryTitle}>{e.title}</Text>
              <Text style={s.entryMeta}>{e.meta}</Text>
            </View>
            {e.sub ? <Text style={s.entrySub}>{e.sub}</Text> : null}
            {e.highlights.map((h, j) => (
              <View key={j} style={s.bullet}>
                <Text style={{ width: 10, color: accent }}>•</Text>
                <Text style={{ flex: 1 }}>{h}</Text>
              </View>
            ))}
            {e.tail ? <Text style={{ ...s.entryMeta, marginTop: 2 }}>{e.tail}</Text> : null}
          </View>
        </View>
      ))}
    </>
  );

  return (
    <Document title={`${b.name} - Resume`} producer="uCareerOS" creator="uCareerOS">
      <Page size={th.paper} style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{b.name}</Text>
          {b.label ? <Text style={s.label}>{b.label}</Text> : null}
        </View>

        <View style={s.row}>
          {/* 侧栏 */}
          <View style={s.side}>
            {(b.email || b.phone || b.location || b.url) && (
              <>
                <Text style={{ ...s.sectionTitle, marginTop: 0 }}>{lang === "en" ? "Contact" : lang === "ja_shokumu" ? "連絡先" : "联系方式"}</Text>
                {[b.email, b.phone, b.location, b.url].filter(Boolean).map((c, i) => (
                  <Text key={i} style={s.sideItem}>{c}</Text>
                ))}
              </>
            )}

            {resume.skills.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t.skills}</Text>
                {resume.skills.map((sk, i) => {
                  const pct = levelPct(sk.level) ?? (sk.level && sk.level !== "0" ? 70 : null);
                  return (
                    <View key={i}>
                      <Text style={s.skillName}>{sk.name}</Text>
                      {pct != null ? (
                        <View style={s.skillBarBg}>
                          <View style={{ ...s.skillBar, width: `${pct}%` }} />
                        </View>
                      ) : (
                        <View style={{ marginBottom: 5 }} />
                      )}
                    </View>
                  );
                })}
              </>
            )}

            {resume.education.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t.education}</Text>
                {resume.education.map((e, i) => (
                  <View key={i} style={{ marginBottom: 5 }}>
                    <Text style={{ ...s.sideItem, fontWeight: 700 }}>{e.institution}</Text>
                    <Text style={s.sideMeta}>
                      {[e.studyType, e.area].filter(Boolean).join("｜")}
                    </Text>
                    <Text style={s.sideMeta}>{range(e.startDate, e.endDate)}</Text>
                  </View>
                ))}
              </>
            )}

            {resume.awards.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t.awards}</Text>
                {resume.awards.map((a, i) => (
                  <Text key={i} style={s.sideItem}>· {a.title}</Text>
                ))}
              </>
            )}
          </View>

          {/* 主栏 */}
          <View style={s.main}>
            {b.summary ? (
              <>
                <Text style={{ ...s.sectionTitle, marginTop: 0 }}>{t.summary}</Text>
                <Text style={s.summary}>{b.summary}</Text>
              </>
            ) : null}

            {resume.work.length > 0 && (
              <>
                <Text style={{ ...s.sectionTitle, marginTop: b.summary ? 10 : 0 }}>{t.work}</Text>
                <Timeline
                  entries={resume.work.map((w) => ({
                    title: `${w.name}${w.position ? `｜${w.position}` : ""}`,
                    meta: range(w.startDate, w.endDate),
                    sub: w.summary,
                    highlights: w.highlights,
                  }))}
                />
              </>
            )}

            {resume.projects.length > 0 && (
              <>
                <Text style={s.sectionTitle}>{t.projects}</Text>
                <Timeline
                  entries={resume.projects.map((p) => ({
                    title: `${p.name}${p.roles.length ? `｜${p.roles.join("、")}` : ""}`,
                    meta: range(p.startDate, p.endDate),
                    sub: p.description,
                    highlights: p.highlights,
                    tail: p.keywords.length ? p.keywords.join(" · ") : undefined,
                  }))}
                />
              </>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
