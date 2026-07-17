import path from "node:path";
import React from "react";
import { Document, Page, Text, View, Font, StyleSheet } from "@react-pdf/renderer";
import type { JsonResume } from "@careeros/shared";

// classic 模板：单栏、衬线感排版，中英日通用（Noto Sans SC 覆盖 CJK）。
// 服务端渲染专用（docs/design/00 ADR-004：react-pdf 路线，模板可插拔）。

const fontsDir = path.join(process.cwd(), "public/fonts");
Font.register({
  family: "NotoSansSC",
  fonts: [
    { src: path.join(fontsDir, "NotoSansSC-Regular.ttf") },
    { src: path.join(fontsDir, "NotoSansSC-Bold.ttf"), fontWeight: 700 },
  ],
});
// 禁用连字符断词（CJK 不适用）
Font.registerHyphenationCallback((word) => [word]);

const s = StyleSheet.create({
  page: { fontFamily: "NotoSansSC", fontSize: 9.5, lineHeight: 1.5, color: "#1a1a1a", padding: 42 },
  name: { fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 },
  label: { fontSize: 10.5, color: "#555" },
  contact: { fontSize: 8.5, color: "#666", marginTop: 4 },
  section: { marginTop: 14 },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, borderBottomWidth: 1, borderBottomColor: "#222",
    paddingBottom: 3, marginBottom: 7,
  },
  entry: { marginBottom: 8 },
  entryHead: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontWeight: 700, fontSize: 10 },
  entryMeta: { color: "#666", fontSize: 8.5 },
  entrySub: { color: "#444", fontSize: 9, marginTop: 1 },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  skillRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  skillChip: {
    fontSize: 8.5, backgroundColor: "#f0f0f0", borderRadius: 3,
    paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 4,
  },
  summary: { marginTop: 10, color: "#333" },
});

const range = (start?: string, end?: string) => (start || end ? `${start ?? ""} ~ ${end || "至今"}` : "");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((h, i) => (
        <View key={i} style={s.bullet}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{h}</Text>
        </View>
      ))}
    </>
  );
}

const SECTION_TITLES: Record<string, Record<string, string>> = {
  zh: { work: "工作经历", projects: "项目经历", skills: "技能", education: "教育经历", awards: "主要成果" },
  en: { work: "Experience", projects: "Projects", skills: "Skills", education: "Education", awards: "Achievements" },
  ja_shokumu: { work: "職務経歴", projects: "プロジェクト", skills: "スキル", education: "学歴", awards: "主な実績" },
};

export function ClassicResume({ resume, lang = "zh" }: { resume: JsonResume; lang?: string }) {
  const t = SECTION_TITLES[lang] ?? SECTION_TITLES.zh;
  const b = resume.basics;
  const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).join("  ·  ");

  return (
    <Document title={`${b.name} - Resume`} producer="CareerOS" creator="CareerOS">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{b.name}</Text>
        {b.label ? <Text style={s.label}>{b.label}</Text> : null}
        {contact ? <Text style={s.contact}>{contact}</Text> : null}
        {b.summary ? <Text style={s.summary}>{b.summary}</Text> : null}

        {resume.work.length > 0 && (
          <Section title={t.work}>
            {resume.work.map((w, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>
                    {w.name}
                    {w.position ? `｜${w.position}` : ""}
                  </Text>
                  <Text style={s.entryMeta}>
                    {range(w.startDate, w.endDate)}
                    {w.location ? `｜${w.location}` : ""}
                  </Text>
                </View>
                {w.summary ? <Text style={s.entrySub}>{w.summary}</Text> : null}
                <Bullets items={w.highlights} />
              </View>
            ))}
          </Section>
        )}

        {resume.projects.length > 0 && (
          <Section title={t.projects}>
            {resume.projects.map((p, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>
                    {p.name}
                    {p.roles.length ? `｜${p.roles.join("、")}` : ""}
                  </Text>
                  <Text style={s.entryMeta}>{range(p.startDate, p.endDate)}</Text>
                </View>
                {p.description ? <Text style={s.entrySub}>{p.description}</Text> : null}
                <Bullets items={p.highlights} />
                {p.keywords.length ? <Text style={{ ...s.entryMeta, marginTop: 2 }}>{p.keywords.join(" · ")}</Text> : null}
              </View>
            ))}
          </Section>
        )}

        {resume.skills.length > 0 && (
          <Section title={t.skills}>
            <View style={s.skillRow}>
              {resume.skills.map((sk, i) => (
                <Text key={i} style={s.skillChip}>
                  {sk.name}
                  {sk.level ? `（${sk.level}）` : ""}
                </Text>
              ))}
            </View>
          </Section>
        )}

        {resume.awards.length > 0 && (
          <Section title={t.awards}>
            <Bullets items={resume.awards.map((a) => `${a.title}${a.date ? `（${a.date}）` : ""}`)} />
          </Section>
        )}

        {resume.education.length > 0 && (
          <Section title={t.education}>
            {resume.education.map((e, i) => (
              <View key={i} style={s.entry}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{e.institution}</Text>
                  <Text style={s.entryMeta}>{range(e.startDate, e.endDate)}</Text>
                </View>
                <Text style={s.entrySub}>
                  {[e.studyType, e.area, e.score ? `GPA ${e.score}` : ""].filter(Boolean).join("｜")}
                </Text>
              </View>
            ))}
          </Section>
        )}
      </Page>
    </Document>
  );
}
