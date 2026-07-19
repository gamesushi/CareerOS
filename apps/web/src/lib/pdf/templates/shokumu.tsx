import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFonts } from "../fonts";
import type { TemplateProps } from "../common";

// 職務経歴書：日本転職市場の標準フォーマット。
// 標題中央 + 日付・氏名右寄せ → 職務要約 → 活かせる経験・知識 → 職務経歴（会社別テーブル）
// → 保有スキル・資格 → 自己PR。編年体（新しい順は JSON の順序に従う）。

const BORDER = "#333333";

const fmtYM = (d?: string) => {
  if (!d) return "";
  const [y, m] = d.split("-");
  return m ? `${y}年${Number(m)}月` : `${y}年`;
};

export function ShokumuTemplate({ resume }: TemplateProps) {
  ensureFonts();
  const b = resume.basics;
  const jis = resume["x-jis"];
  const today = new Date();
  const dateLine = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日現在`;

  const s = StyleSheet.create({
    page: { fontFamily: "NotoSansJP", fontSize: 9.5, lineHeight: 1.55, color: "#1a1a1a", padding: 46 },
    title: { fontSize: 16, fontWeight: 700, textAlign: "center", letterSpacing: 6, marginBottom: 6 },
    meta: { textAlign: "right", fontSize: 9, color: "#333" },
    sectionTitle: {
      fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6,
      borderBottomWidth: 1.2, borderBottomColor: BORDER, paddingBottom: 2,
    },
    para: { color: "#222" },
    bullet: { flexDirection: "row", marginTop: 2 },
    companyHead: {
      backgroundColor: "#f2f2f2", borderWidth: 0.8, borderColor: BORDER,
      paddingVertical: 3, paddingHorizontal: 6, marginTop: 8,
      flexDirection: "row", justifyContent: "space-between",
    },
    companyName: { fontWeight: 700, fontSize: 10 },
    table: { borderLeftWidth: 0.8, borderRightWidth: 0.8, borderBottomWidth: 0.8, borderColor: BORDER },
    tr: { flexDirection: "row", borderTopWidth: 0.8, borderColor: BORDER },
    tdPeriod: { width: 92, borderRightWidth: 0.8, borderColor: BORDER, padding: 5, fontSize: 8.5 },
    tdBody: { flex: 1, padding: 5 },
    skillLine: { marginTop: 2 },
  });

  const works = resume.work;
  const projectsByCompany = new Map<string, typeof resume.projects>();
  const orphanProjects: typeof resume.projects = [];
  for (const p of resume.projects) {
    // 项目按名称包含公司名粗略归属；不确定的归入独立块
    const owner = works.find((w) => p.name.includes(w.name) || (p.description ?? "").includes(w.name));
    if (owner) {
      const list = projectsByCompany.get(owner.name) ?? [];
      list.push(p);
      projectsByCompany.set(owner.name, list);
    } else {
      orphanProjects.push(p);
    }
  }

  return (
    <Document title={`${b.name} - 職務経歴書`} producer="CareerOS" creator="CareerOS">
      <Page size="A4" style={s.page}>
        <Text style={s.title}>職 務 経 歴 書</Text>
        <Text style={s.meta}>{dateLine}</Text>
        <Text style={s.meta}>氏名　{b.name}</Text>

        {(jis?.shokumuYoyaku || b.summary) && (
          <>
            <Text style={s.sectionTitle}>■ 職務要約</Text>
            <Text style={s.para}>{jis?.shokumuYoyaku ?? b.summary}</Text>
          </>
        )}

        {jis?.ikaseruKeiken && jis.ikaseruKeiken.length > 0 && (
          <>
            <Text style={s.sectionTitle}>■ 活かせる経験・知識</Text>
            {jis.ikaseruKeiken.map((k, i) => (
              <View key={i} style={s.bullet}>
                <Text style={{ width: 12 }}>・</Text>
                <Text style={{ flex: 1 }}>{k}</Text>
              </View>
            ))}
          </>
        )}

        {works.length > 0 && (
          <>
            <Text style={s.sectionTitle}>■ 職務経歴</Text>
            {works.map((w, i) => {
              const projs = projectsByCompany.get(w.name) ?? [];
              return (
                <View key={i} wrap={false}>
                  <View style={s.companyHead}>
                    <Text style={s.companyName}>{w.name}</Text>
                    <Text style={{ fontSize: 8.5 }}>
                      {fmtYM(w.startDate)} 〜 {w.endDate ? fmtYM(w.endDate) : "現在"}
                    </Text>
                  </View>
                  <View style={s.table}>
                    <View style={s.tr}>
                      <Text style={s.tdPeriod}>役職</Text>
                      <Text style={s.tdBody}>{w.position}{w.location ? `（${w.location}）` : ""}</Text>
                    </View>
                    <View style={s.tr}>
                      <Text style={s.tdPeriod}>業務内容</Text>
                      <View style={s.tdBody}>
                        {w.summary ? <Text>{w.summary}</Text> : null}
                        {w.highlights.map((h, j) => (
                          <View key={j} style={s.bullet}>
                            <Text style={{ width: 12 }}>・</Text>
                            <Text style={{ flex: 1 }}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {projs.length > 0 && (
                      <View style={s.tr}>
                        <Text style={s.tdPeriod}>主なプロジェクト</Text>
                        <View style={s.tdBody}>
                          {projs.map((p, j) => (
                            <View key={j} style={{ marginBottom: 3 }}>
                              <Text style={{ fontWeight: 700 }}>
                                {p.name}
                                {p.startDate ? `（${fmtYM(p.startDate)}〜${p.endDate ? fmtYM(p.endDate) : "現在"}）` : ""}
                              </Text>
                              {p.description ? <Text>{p.description}</Text> : null}
                              {p.highlights.map((h, k) => (
                                <View key={k} style={s.bullet}>
                                  <Text style={{ width: 12 }}>・</Text>
                                  <Text style={{ flex: 1 }}>{h}</Text>
                                </View>
                              ))}
                            </View>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </>
        )}

        {orphanProjects.length > 0 && (
          <>
            <Text style={s.sectionTitle}>■ その他のプロジェクト</Text>
            {orphanProjects.map((p, i) => (
              <View key={i} style={{ marginBottom: 5 }} wrap={false}>
                <Text style={{ fontWeight: 700 }}>
                  {p.name}
                  {p.roles.length ? `｜${p.roles.join("、")}` : ""}
                  {p.startDate ? `（${fmtYM(p.startDate)}〜${p.endDate ? fmtYM(p.endDate) : "現在"}）` : ""}
                </Text>
                {p.description ? <Text>{p.description}</Text> : null}
                {p.highlights.map((h, j) => (
                  <View key={j} style={s.bullet}>
                    <Text style={{ width: 12 }}>・</Text>
                    <Text style={{ flex: 1 }}>{h}</Text>
                  </View>
                ))}
              </View>
            ))}
          </>
        )}

        {(resume.skills.length > 0 || (jis?.menkyoShikaku?.length ?? 0) > 0) && (
          <>
            <Text style={s.sectionTitle}>■ 保有スキル・資格</Text>
            {resume.skills.length > 0 && (
              <Text style={s.skillLine}>
                {resume.skills.map((sk) => sk.name).join("　／　")}
              </Text>
            )}
            {jis?.menkyoShikaku?.map((m, i) => (
              <View key={i} style={s.bullet}>
                <Text style={{ width: 12 }}>・</Text>
                <Text style={{ flex: 1 }}>{m.name}{m.date ? `（${fmtYM(m.date)}）` : ""}</Text>
              </View>
            ))}
          </>
        )}

        {jis?.jikoPR && (
          <>
            <Text style={s.sectionTitle}>■ 自己PR</Text>
            <Text style={s.para}>{jis.jikoPR}</Text>
          </>
        )}

        <Text style={{ textAlign: "right", marginTop: 16 }}>以上</Text>
      </Page>
    </Document>
  );
}
