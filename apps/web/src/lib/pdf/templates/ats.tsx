import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { Bullets, range, type TemplateProps } from "../common";
import { ensureFonts } from "../fonts";

// ats：美式 ATS（申请人追踪系统）优化英文简历。
// 设计原则：单栏、无照片/无年龄、关键词命中友好、量化成就前置。
// 字体用 NotoSansSC：同时覆盖 Latin 与 CJK，避免中国用户简历里的中文公司/学校/语言名被丢字。
// 分区标题用全大写（ATS 强信号），强调色仅用于标题下短横线。

const DEFAULT_ACCENT = "#111111";

const H = (label: string) => label; // 分区标题直接由调用方传入全大写英文

export function AtsTemplate({ resume, lang = "en", accent = DEFAULT_ACCENT }: TemplateProps) {
  ensureFonts();
  const b = resume.basics;

  // 联系方式：邮箱 · 手机 · 城市 · LinkedIn/个人站
  const contacts = [
    b.email,
    b.phone,
    b.location,
    ...(Array.isArray(b.profiles) ? b.profiles.map((p) => `${p.network}: ${p.url}`) : []),
  ].filter(Boolean);

  const s = StyleSheet.create({
    page: { fontFamily: "NotoSansSC", fontSize: 9.5, lineHeight: 1.45, color: "#111111", padding: 44 },
    name: { fontSize: 19, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" },
    label: { fontSize: 10.5, color: "#444", marginTop: 2 },
    contact: { fontSize: 8.5, color: "#555", marginTop: 4 },
    rule: { borderBottomWidth: 1, borderBottomColor: "#cccccc", marginTop: 8, marginBottom: 4 },
    section: { marginTop: 12 },
    sectionTitle: {
      fontSize: 10.5, fontWeight: 700, color: accent, letterSpacing: 1,
      borderBottomWidth: 1.2, borderBottomColor: accent, paddingBottom: 2, marginBottom: 6,
    },
    entry: { marginBottom: 8 },
    entryHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
    entryTitle: { fontWeight: 700, fontSize: 10 },
    entryMeta: { color: "#555", fontSize: 8.5, marginLeft: 8 },
    entrySub: { color: "#333", fontSize: 9, marginTop: 1 },
    summary: { color: "#222" },
    skillRow: { flexDirection: "row", flexWrap: "wrap" },
    skillChip: { fontSize: 8.5, color: "#222", marginRight: 6, marginBottom: 3 },
    bullets: { marginTop: 1 },
  });

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{H(title)}</Text>
      {children}
    </View>
  );

  return (
    <Document title={`${b.name} - Resume`} producer="CareerOS" creator="CareerOS">
      <Page size="LETTER" style={s.page}>
        <Text style={s.name}>{b.name}</Text>
        {b.label ? <Text style={s.label}>{b.label}</Text> : null}
        {contacts.length > 0 && <Text style={s.contact}>{contacts.join("  ·  ")}</Text>}
        <View style={s.rule} />

        {b.summary ? (
          <Section title="SUMMARY">
            <Text style={s.summary}>{b.summary}</Text>
          </Section>
        ) : null}

        {resume.work.length > 0 && (
          <Section title="EXPERIENCE">
            {resume.work.map((w, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{w.position}{w.name ? `, ${w.name}` : ""}</Text>
                  <Text style={s.entryMeta}>{range(w.startDate, w.endDate)}{w.location ? ` | ${w.location}` : ""}</Text>
                </View>
                {w.summary ? <Text style={s.entrySub}>{w.summary}</Text> : null}
                {w.highlights.length > 0 && (
                  <View style={s.bullets}>
                    <Bullets items={w.highlights} size={9} />
                  </View>
                )}
              </View>
            ))}
          </Section>
        )}

        {resume.projects.length > 0 && (
          <Section title="PROJECTS">
            {resume.projects.map((p, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{p.name}{p.roles.length ? ` (${p.roles.join(", ")})` : ""}</Text>
                  <Text style={s.entryMeta}>{range(p.startDate, p.endDate)}</Text>
                </View>
                {p.description ? <Text style={s.entrySub}>{p.description}</Text> : null}
                {p.highlights.length > 0 && (
                  <View style={s.bullets}>
                    <Bullets items={p.highlights} size={9} />
                  </View>
                )}
                {p.keywords.length ? (
                  <Text style={{ ...s.entryMeta, marginTop: 2 }}>Skills: {p.keywords.join(", ")}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        )}

        {resume.skills.length > 0 && (
          <Section title="SKILLS">
            <View style={s.skillRow}>
              {resume.skills.map((sk, i) => (
                <Text key={i} style={s.skillChip}>
                  {sk.name}{sk.level && sk.level !== "0" ? ` (${sk.level})` : ""}
                </Text>
              ))}
            </View>
          </Section>
        )}

        {resume.awards.length > 0 && (
          <Section title="AWARDS & HONORS">
            <Bullets
              items={resume.awards.map((a) =>
                [a.title, a.issuer, a.date].filter(Boolean).join(", "),
              )}
              size={9}
            />
          </Section>
        )}

        {resume.education.length > 0 && (
          <Section title="EDUCATION">
            {resume.education.map((e, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{e.institution}</Text>
                  <Text style={s.entryMeta}>{range(e.startDate, e.endDate)}</Text>
                </View>
                <Text style={s.entrySub}>
                  {[e.studyType, e.area, e.score ? `GPA ${e.score}` : ""].filter(Boolean).join(", ")}
                </Text>
              </View>
            ))}
          </Section>
        )}

        {(() => {
          const langs = (resume as Record<string, unknown>)["x-meta"] as
            | { languages?: string[] }
            | undefined;
          const list = langs?.languages;
          return list && list.length > 0 ? (
            <Section title="LANGUAGES">
              <Text style={s.entrySub}>{list.join("  ·  ")}</Text>
            </Section>
          ) : null;
        })()}
      </Page>
    </Document>
  );
}
