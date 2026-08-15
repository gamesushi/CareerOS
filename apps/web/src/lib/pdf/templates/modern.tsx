import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFonts } from "../fonts";
import { Bullets, contactLine, range, titlesFor, type TemplateProps } from "../common";
import { resolveTheme, themedStyles } from "../theme";

// modern：参考 Reactive Resume「Onyx」布局思路的原创实现——
// 左对齐 header + accent 粗横线分隔，分区标题 accent 色大写风格，技能带边框 chips。

const DEFAULT_ACCENT = "#2563eb";

export function ModernTemplate({ resume, lang = "zh", accent = DEFAULT_ACCENT }: TemplateProps) {
  ensureFonts();
  const t = titlesFor(lang);
  const b = resume.basics;
  const th = resolveTheme(resume);

  const s = themedStyles({
    page: { fontFamily: "NotoSansSC", fontSize: 9.5, lineHeight: 1.5, color: "#1f1f1f", padding: 42 },
    name: { fontSize: 22, fontWeight: 700, lineHeight: 1.2 },
    label: { fontSize: 11, color: accent, fontWeight: 700, marginTop: 2 },
    contact: { fontSize: 8.5, color: "#666", marginTop: 5 },
    headerRule: { height: 2.5, backgroundColor: accent, marginTop: 10 },
    summary: { marginTop: 10, color: "#333" },
    section: { marginTop: 13 },
    sectionTitle: { fontSize: 11.5, fontWeight: 700, color: accent, letterSpacing: 1, marginBottom: 6 },
    entry: { marginBottom: 8 },
    entryHead: { flexDirection: "row", justifyContent: "space-between" },
    entryTitle: { fontWeight: 700, fontSize: 10 },
    entryMeta: { color: "#777", fontSize: 8.5 },
    entrySub: { color: "#444", fontSize: 9, marginTop: 1 },
    skillRow: { flexDirection: "row", flexWrap: "wrap" },
    skillChip: {
      fontSize: 8.5, color: accent, borderWidth: 1, borderColor: accent, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 2, marginRight: 5, marginBottom: 5,
    },
    awardRow: { flexDirection: "row", marginTop: 2 },
    awardMarker: { width: 10, color: accent },
  }, th);

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <Document title={`${b.name} - Resume`} producer="uCareerOS" creator="uCareerOS">
      <Page size={th.paper} style={s.page}>
        <Text style={s.name}>{b.name}</Text>
        {b.label ? <Text style={s.label}>{b.label}</Text> : null}
        {contactLine(b) ? <Text style={s.contact}>{contactLine(b)}</Text> : null}
        <View style={s.headerRule} />
        {b.summary ? <Text style={s.summary}>{b.summary}</Text> : null}

        {resume.work.length > 0 && (
          <Section title={t.work}>
            {resume.work.map((w, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{w.position}{w.name ? ` · ${w.name}` : ""}</Text>
                  <Text style={s.entryMeta}>{range(w.startDate, w.endDate)}{w.location ? `｜${w.location}` : ""}</Text>
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
                  <Text style={s.entryTitle}>{p.name}{p.roles.length ? ` · ${p.roles.join("、")}` : ""}</Text>
                  <Text style={s.entryMeta}>{range(p.startDate, p.endDate)}</Text>
                </View>
                {p.description ? <Text style={s.entrySub}>{p.description}</Text> : null}
                <Bullets items={p.highlights} />
                {p.keywords.length ? (
                  <Text style={{ fontSize: 8.5, color: accent, marginTop: 2 }}>{p.keywords.join(" · ")}</Text>
                ) : null}
              </View>
            ))}
          </Section>
        )}

        {resume.awards.length > 0 && (
          <Section title={t.awards}>
            {resume.awards.map((a, i) => (
              <View key={i} style={s.awardRow}>
                <Text style={s.awardMarker}>▸</Text>
                <Text style={{ flex: 1 }}>{a.title}{a.date ? `（${a.date}）` : ""}</Text>
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
                </Text>
              ))}
            </View>
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
