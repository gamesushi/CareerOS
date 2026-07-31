import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFonts } from "../fonts";
import { Bullets, contactLine, range, titlesFor, type TemplateProps } from "../common";
import { resolveTheme, themedStyles } from "../theme";

// compact：参考 Reactive Resume「Kakuna」布局思路的原创实现——
// 全居中极简排版，居中分区标题带细底线，紧凑字号，适合一页塞下更多内容。

const DEFAULT_ACCENT = "#525252";

export function CompactTemplate({ resume, lang = "zh", accent = DEFAULT_ACCENT }: TemplateProps) {
  ensureFonts();
  const t = titlesFor(lang);
  const b = resume.basics;
  const th = resolveTheme(resume);

  const s = themedStyles({
    page: { fontFamily: "NotoSansSC", fontSize: 9, lineHeight: 1.45, color: "#222", padding: 36 },
    header: { alignItems: "center", marginBottom: 8 },
    name: { fontSize: 18, fontWeight: 700, lineHeight: 1.2 },
    label: { fontSize: 10, color: "#555", marginTop: 1 },
    contact: { fontSize: 8, color: "#666", marginTop: 3 },
    summary: { color: "#333", textAlign: "center", marginTop: 4, paddingHorizontal: 20 },
    section: { marginTop: 10 },
    sectionTitleWrap: { alignItems: "center", marginBottom: 6 },
    sectionTitle: {
      fontSize: 10, fontWeight: 700, letterSpacing: 2, color: accent,
      borderBottomWidth: 0.8, borderBottomColor: accent, paddingBottom: 2, paddingHorizontal: 14,
    },
    entry: { marginBottom: 6 },
    entryHead: { flexDirection: "row", justifyContent: "space-between" },
    entryTitle: { fontWeight: 700, fontSize: 9.5 },
    entryMeta: { color: "#777", fontSize: 8 },
    entrySub: { color: "#444", fontSize: 8.5, marginTop: 1 },
    skillLine: { textAlign: "center", fontSize: 9, color: "#333" },
  }, th);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <View style={s.sectionTitleWrap}>
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );

  return (
    <Document title={`${b.name} - Resume`} producer="CareerOS" creator="CareerOS">
      <Page size={th.paper} style={s.page}>
        <View style={s.header}>
          <Text style={s.name}>{b.name}</Text>
          {b.label ? <Text style={s.label}>{b.label}</Text> : null}
          {contactLine(b) ? <Text style={s.contact}>{contactLine(b)}</Text> : null}
          {b.summary ? <Text style={s.summary}>{b.summary}</Text> : null}
        </View>

        {resume.work.length > 0 && (
          <Section title={t.work}>
            {resume.work.map((w, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{w.name}{w.position ? `｜${w.position}` : ""}</Text>
                  <Text style={s.entryMeta}>{range(w.startDate, w.endDate)}{w.location ? `｜${w.location}` : ""}</Text>
                </View>
                {w.summary ? <Text style={s.entrySub}>{w.summary}</Text> : null}
                <Bullets items={w.highlights} size={8.5} />
              </View>
            ))}
          </Section>
        )}

        {resume.projects.length > 0 && (
          <Section title={t.projects}>
            {resume.projects.map((p, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{p.name}{p.roles.length ? `｜${p.roles.join("、")}` : ""}</Text>
                  <Text style={s.entryMeta}>{range(p.startDate, p.endDate)}</Text>
                </View>
                {p.description ? <Text style={s.entrySub}>{p.description}</Text> : null}
                <Bullets items={p.highlights} size={8.5} />
              </View>
            ))}
          </Section>
        )}

        {resume.awards.length > 0 && (
          <Section title={t.awards}>
            <Bullets items={resume.awards.map((a) => `${a.title}${a.date ? `（${a.date}）` : ""}`)} size={8.5} />
          </Section>
        )}

        {resume.skills.length > 0 && (
          <Section title={t.skills}>
            <Text style={s.skillLine}>
              {resume.skills
                .map((sk) => `${sk.name}${sk.level && sk.level !== "0" ? `（${sk.level}）` : ""}`)
                .join("　·　")}
            </Text>
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
