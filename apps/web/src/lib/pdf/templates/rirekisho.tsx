import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { ensureFonts } from "../fonts";
import type { TemplateProps } from "../common";
import { resolveTheme, themedStyles } from "../theme";

// 履歴書：JIS 様式に準拠した表形式。
// 基本情報欄（ふりがな/氏名/生年月日/住所/連絡先 + 写真枠）→ 学歴・職歴年表 →
// 免許・資格 → 志望動機・自己PR → 本人希望記入欄。
// 生年月日・住所・ふりがな等は AI が創作しない方針（ADR-005）のため、
// 空欄はそのまま空欄として印字（手書き文化に合わせ枠は常に描画）。

const B = "#333333";

const splitYM = (d?: string): { y: string; m: string } => {
  if (!d) return { y: "", m: "" };
  const [y, m] = d.split("-");
  return { y: y ?? "", m: m ? String(Number(m)) : "" };
};

const age = (birth?: string): string => {
  if (!birth || !/^\d{4}-\d{2}(-\d{2})?$/.test(birth)) return "";
  const [y, m, d] = birth.split("-").map(Number);
  const now = new Date();
  let a = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < (d ?? 1))) a--;
  return `（満${a}歳）`;
};

export function RirekishoTemplate({ resume }: TemplateProps) {
  ensureFonts();
  const b = resume.basics;
  const th = resolveTheme(resume, "jp");
  const jis = resume["x-jis"];
  const today = new Date();
  const dateLine = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日現在`;
  const birth = jis?.birthDate ? splitYM(jis.birthDate) : { y: "", m: "" };
  const birthDay = jis?.birthDate?.split("-")[2];

  const s = themedStyles({
    page: { fontFamily: "NotoSansJP", fontSize: 9, lineHeight: 1.4, color: "#1a1a1a", padding: 40 },
    title: { fontSize: 16, fontWeight: 700, letterSpacing: 8, marginBottom: 2 },
    dateLine: { fontSize: 8.5, textAlign: "right", marginBottom: 4 },
    // 表格通用
    box: { borderWidth: 1, borderColor: B },
    row: { flexDirection: "row" },
    cellLabel: { backgroundColor: "#f5f5f5", fontSize: 7.5, paddingHorizontal: 4, paddingVertical: 2, color: "#444" },
    // 年表
    thYear: { width: 52, textAlign: "center", fontSize: 8.5, paddingVertical: 3, fontWeight: 700 },
    thMonth: { width: 34, textAlign: "center", fontSize: 8.5, paddingVertical: 3, fontWeight: 700 },
    thBody: { flex: 1, textAlign: "center", fontSize: 8.5, paddingVertical: 3, fontWeight: 700 },
    tdYear: { width: 52, textAlign: "center", paddingVertical: 3, fontSize: 8.5 },
    tdMonth: { width: 34, textAlign: "center", paddingVertical: 3, fontSize: 8.5 },
    tdBody: { flex: 1, paddingVertical: 3, paddingHorizontal: 6, fontSize: 9 },
    bl: { borderLeftWidth: 0.8, borderColor: B },
    bt: { borderTopWidth: 0.8, borderColor: B },
    sectionGap: { marginTop: 10 },
    freeBox: { borderWidth: 1, borderColor: B, padding: 6, minHeight: 64 },
    freeTitle: { fontSize: 8, color: "#444", marginBottom: 3 },
  }, th);

  // 学歴・職歴年表行
  type Row = { y: string; m: string; text: string; center?: boolean; right?: boolean };
  const rows: Row[] = [];
  // 履歴書年表は古い順（編年体）。入力順に依存せず日付で明示ソート。
  const byStartAsc = <T extends { startDate?: string }>(items: T[]) =>
    [...items].sort((a, b) => (a.startDate ?? "9999").localeCompare(b.startDate ?? "9999"));

  if (resume.education.length > 0) {
    rows.push({ y: "", m: "", text: "学　歴", center: true });
    for (const e of byStartAsc(resume.education)) {
      const start = splitYM(e.startDate);
      const end = splitYM(e.endDate);
      const name = [e.institution, e.area].filter(Boolean).join("　");
      if (start.y) rows.push({ y: start.y, m: start.m, text: `${name}　入学` });
      if (end.y) rows.push({ y: end.y, m: end.m, text: `${name}　卒業` });
    }
  }
  if (resume.work.length > 0) {
    rows.push({ y: "", m: "", text: "職　歴", center: true });
    for (const w of byStartAsc(resume.work)) {
      const start = splitYM(w.startDate);
      const end = splitYM(w.endDate);
      if (start.y) rows.push({ y: start.y, m: start.m, text: `${w.name}　入社（${w.position}）` });
      if (end.y) rows.push({ y: end.y, m: end.m, text: `${w.name}　退社` });
      else rows.push({ y: "", m: "", text: "現在に至る" });
    }
  }
  rows.push({ y: "", m: "", text: "以上", right: true });

  return (
    <Document title={`${b.name} - 履歴書`} producer="CareerOS" creator="CareerOS">
      <Page size={th.paper} style={s.page}>
        <Text style={s.title}>履　歴　書</Text>
        <Text style={s.dateLine}>{dateLine}</Text>

        {/* 基本情報欄 + 写真枠 */}
        <View style={s.row}>
          <View style={{ ...s.box, flex: 1 }}>
            <View>
              <Text style={s.cellLabel}>ふりがな</Text>
              <Text style={{ paddingHorizontal: 6, paddingVertical: 1, fontSize: 8.5, minHeight: 14 }}>
                {jis?.furigana ?? ""}
              </Text>
            </View>
            <View style={s.bt}>
              <Text style={s.cellLabel}>氏名</Text>
              <Text style={{ paddingHorizontal: 6, paddingVertical: 4, fontSize: 15, minHeight: 30 }}>{b.name}</Text>
            </View>
            <View style={{ ...s.bt, ...s.row }}>
              <View style={{ flex: 1 }}>
                <Text style={s.cellLabel}>生年月日</Text>
                <Text style={{ paddingHorizontal: 6, paddingVertical: 2, minHeight: 16 }}>
                  {birth.y ? `${birth.y}年${birth.m}月${birthDay ? `${Number(birthDay)}日` : ""}生 ${age(jis?.birthDate)}` : ""}
                </Text>
              </View>
            </View>
          </View>
          {/* 写真枠（40×30mm 相当） */}
          <View
            style={{
              width: 85, height: 113, marginLeft: 10, borderWidth: 0.8, borderColor: "#999",
              borderStyle: "dashed", alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 7.5, color: "#999", textAlign: "center" }}>写真貼付{"\n"}（縦40mm×横30mm）</Text>
          </View>
        </View>

        <View style={{ ...s.box, marginTop: 6 }}>
          <View>
            <Text style={s.cellLabel}>現住所</Text>
            <Text style={{ paddingHorizontal: 6, paddingVertical: 2, minHeight: 18 }}>
              {jis?.address ?? b.location ?? ""}
            </Text>
          </View>
          <View style={{ ...s.bt, ...s.row }}>
            <View style={{ flex: 1 }}>
              <Text style={s.cellLabel}>電話</Text>
              <Text style={{ paddingHorizontal: 6, paddingVertical: 2, minHeight: 16 }}>{b.phone ?? ""}</Text>
            </View>
            <View style={{ flex: 1.4, ...s.bl }}>
              <Text style={s.cellLabel}>E-mail</Text>
              <Text style={{ paddingHorizontal: 6, paddingVertical: 2, minHeight: 16 }}>{b.email ?? ""}</Text>
            </View>
          </View>
        </View>

        {/* 学歴・職歴 */}
        <View style={{ ...s.box, ...s.sectionGap }}>
          <View style={{ ...s.row, backgroundColor: "#f5f5f5" }}>
            <Text style={s.thYear}>年</Text>
            <Text style={{ ...s.thMonth, ...s.bl }}>月</Text>
            <Text style={{ ...s.thBody, ...s.bl }}>学歴・職歴</Text>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={{ ...s.row, ...s.bt }} wrap={false}>
              <Text style={s.tdYear}>{r.y}</Text>
              <Text style={{ ...s.tdMonth, ...s.bl }}>{r.m}</Text>
              <Text
                style={{
                  ...s.tdBody,
                  ...s.bl,
                  ...(r.center ? { textAlign: "center", fontWeight: 700 } : {}),
                  ...(r.right ? { textAlign: "right" } : {}),
                }}
              >
                {r.text}
              </Text>
            </View>
          ))}
        </View>

        {/* 免許・資格 */}
        <View style={{ ...s.box, ...s.sectionGap }} wrap={false}>
          <View style={{ ...s.row, backgroundColor: "#f5f5f5" }}>
            <Text style={s.thYear}>年</Text>
            <Text style={{ ...s.thMonth, ...s.bl }}>月</Text>
            <Text style={{ ...s.thBody, ...s.bl }}>免許・資格</Text>
          </View>
          {(jis?.menkyoShikaku?.length ? jis.menkyoShikaku : [{ date: undefined, name: "" }]).map((m, i) => {
            const ym = splitYM(m.date);
            return (
              <View key={i} style={{ ...s.row, ...s.bt }}>
                <Text style={s.tdYear}>{ym.y}</Text>
                <Text style={{ ...s.tdMonth, ...s.bl }}>{ym.m}</Text>
                <Text style={{ ...s.tdBody, ...s.bl }}>{m.name}</Text>
              </View>
            );
          })}
        </View>

        {/* 志望動機・自己PR */}
        <View style={{ ...s.freeBox, ...s.sectionGap }} wrap={false}>
          <Text style={s.freeTitle}>志望の動機、特技、自己PR、アピールポイントなど</Text>
          <Text>
            {[jis?.shiboudouki, jis?.jikoPR].filter(Boolean).join("\n\n")}
          </Text>
        </View>

        {/* 本人希望記入欄 */}
        <View style={{ ...s.freeBox, ...s.sectionGap, minHeight: 44 }} wrap={false}>
          <Text style={s.freeTitle}>本人希望記入欄（給料・職種・勤務時間・勤務地・その他についての希望があれば記入）</Text>
          <Text>{jis?.honninKibou ?? "貴社の規定に従います。"}</Text>
        </View>
      </Page>
    </Document>
  );
}
