import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFonts } from "../fonts";
import { Bullets, contactLine, range, titlesFor, type TemplateProps } from "../common";

// classic：单栏经典排版，黑白为主，accent 仅用于分区标题下划线。

const DEFAULT_ACCENT = "#222222";

export function ClassicTemplate({ resume, lang = "zh", accent = DEFAULT_ACCENT }: TemplateProps) {
  ensureFonts();
  const t = titlesFor(lang);
  const b = resume.basics;

  const s = StyleSheet.create({
    page: { fontFamily: "NotoSansSC", fontSize: 9.5, lineHeight: 1.5, color: "#1a1a1a", padding: 42 },
    name: { fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 },
    label: { fontSize: 10.5, color: "#555" },
    contact: { fontSize: 8.5, color: "#666", marginTop: 4 },
    summary: { marginTop: 10, color: "#333" },
    section: { marginTop: 14 },
    sectionTitle: {
      fontSize: 11, fontWeight: 700, borderBottomWidth: 1, borderBottomColor: accent,
      paddingBottom: 3, marginBottom: 7,
    },
    entry: { marginBottom: 8 },
    entryHead: { flexDirection: "row", justifyContent: "space-between" },
    entryTitle: { fontWeight: 700, fontSize: 10 },
    entryMeta: { color: "#666", fontSize: 8.5 },
    entrySub: { color: "#444", fontSize: 9, marginTop: 1 },
    skillRow: { flexDirection: "row", flexWrap: "wrap" },
    skillChip: {
      fontSize: 8.5, backgroundColor: "#f0f0f0", borderRadius: 3,
      paddingHorizontal: 6, paddingVertical: 2, marginRight: 4, marginBottom: 4,
    },
  });

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  return (
    <Document title={`${b.name} - Resume`} producer="CareerOS" creator="CareerOS">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{b.name}</Text>
        {b.label ? <Text style={s.label}>{b.label}</Text> : null}
        {contactLine(b) ? <Text style={s.contact}>{contactLine(b)}</Text> : null}
        {b.summary ? <Text style={s.summary}>{b.summary}</Text> : null}

        {resume.work.length > 0 && (
          <Section title={t.work}>
            {resume.work.map((w, i) => (
              <View key={i} style={s.entry} wrap={false}>
                <View style={s.entryHead}>
                  <Text style={s.entryTitle}>{w.name}{w.position ? `｜${w.position}` : ""}</Text>
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
                  <Text style={s.entryTitle}>{p.name}{p.roles.length ? `｜${p.roles.join("、")}` : ""}</Text>
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
                  {sk.name}{sk.level && sk.level !== "0" ? `（${sk.level}）` : ""}
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
