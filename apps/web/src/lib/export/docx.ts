import { Document, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import type { JsonResume } from "@careeros/shared";

// 简历 JSON → .docx（通用结构化 Word 文档，不绑定模板视觉）。
// 一次生成，标题/分区/条目用 Word 原生样式，便于二次编辑。
// 注：docx v9 的打包器导出名是 `Packer`（`Packer.toBuffer(doc): Promise<Buffer>`）。

export async function resumeToDocx(resume: JsonResume): Promise<Buffer> {
  const b = resume.basics;
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: b.name || "简历", bold: true })] }),
  );
  if (b.label) {
    children.push(new Paragraph({ children: [new TextRun({ text: b.label, italics: true })] }));
  }
  const contact = [b.email, b.phone, b.location].filter(Boolean).join("  ·  ");
  if (contact) children.push(new Paragraph({ children: [new TextRun({ text: contact })] }));

  const pushSection = (title: string, paras: Paragraph[]) => {
    if (paras.length === 0) return;
    children.push(
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun({ text: title, bold: true })] }),
    );
    children.push(...paras);
  };

  if (b.summary) {
    children.push(new Paragraph({ children: [new TextRun({ text: b.summary })] }));
  }

  pushSection(
    "工作经历",
    resume.work.flatMap((w) => {
      const out: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: `${w.position}${w.name ? `, ${w.name}` : ""}${
                w.startDate ? `（${w.startDate} - ${w.endDate || "至今"}）` : ""
              }`,
              bold: true,
            }),
          ],
        }),
      ];
      if (w.summary) out.push(new Paragraph({ children: [new TextRun({ text: w.summary })] }));
      for (const h of w.highlights) out.push(new Paragraph({ children: [new TextRun({ text: `• ${h}` })] }));
      return out;
    }),
  );

  pushSection(
    "项目经历",
    resume.projects.flatMap((p) => {
      const out: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: `${p.name}${p.roles.length ? `（${p.roles.join("、")}）` : ""}`,
              bold: true,
            }),
          ],
        }),
      ];
      if (p.description) out.push(new Paragraph({ children: [new TextRun({ text: p.description })] }));
      for (const h of p.highlights) out.push(new Paragraph({ children: [new TextRun({ text: `• ${h}` })] }));
      if (p.keywords.length) {
        out.push(new Paragraph({ children: [new TextRun({ text: `关键词：${p.keywords.join("、")}` })] }));
      }
      return out;
    }),
  );

  pushSection(
    "技能",
    resume.skills.map((sk) =>
      new Paragraph({
        children: [new TextRun({ text: `${sk.name}${sk.level && sk.level !== "0" ? `（${sk.level}）` : ""}` })],
      }),
    ),
  );

  pushSection(
    "教育经历",
    resume.education.map((e) => {
      const sub = [e.studyType, e.area, e.score ? `GPA ${e.score}` : ""].filter(Boolean).join("，");
      const meta = [e.startDate, e.endDate].filter(Boolean).join(" - ");
      return new Paragraph({
        children: [new TextRun({ text: `${e.institution}　|　${[sub, meta].filter(Boolean).join("　|　")}` })],
      });
    }),
  );

  pushSection(
    "主要成果",
    resume.awards.map((a) => {
      const parts = [a.title, a.issuer, a.date].filter(Boolean).join("，");
      return new Paragraph({ children: [new TextRun({ text: parts })] });
    }),
  );

  const langs = (resume as Record<string, unknown>)["x-meta"] as { languages?: string[] } | undefined;
  if (langs?.languages?.length) {
    pushSection("语言能力", [new Paragraph({ children: [new TextRun({ text: langs.languages.join("　·　") })] })]);
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
