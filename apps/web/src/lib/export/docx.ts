import { Document, Paragraph, TextRun, HeadingLevel, Packer } from "docx";
import type { JsonResume } from "@careeros/shared";
import { titlesFor, inlineLabels } from "../pdf/titles";

// 简历 JSON → .docx（通用结构化 Word 文档，不绑定模板视觉）。
// 一次生成，标题/分区/条目用 Word 原生样式；标题按简历语言本地化。

export async function resumeToDocx(resume: JsonResume, lang?: string): Promise<Buffer> {
  const b = resume.basics;
  const T = titlesFor(lang);
  const I = inlineLabels(lang);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun({ text: b.name || I.fallbackName, bold: true })] }),
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
    T.work,
    resume.work.flatMap((w) => {
      const out: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: `${w.position}${w.name ? `, ${w.name}` : ""}${
                w.startDate ? `（${w.startDate} - ${w.endDate || I.present}）` : ""
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
    T.projects,
    resume.projects.flatMap((p) => {
      const out: Paragraph[] = [
        new Paragraph({
          children: [
            new TextRun({
              text: `${p.name}${p.roles.length ? `（${p.roles.join(I.enumSep)}）` : ""}`,
              bold: true,
            }),
          ],
        }),
      ];
      if (p.description) out.push(new Paragraph({ children: [new TextRun({ text: p.description })] }));
      for (const h of p.highlights) out.push(new Paragraph({ children: [new TextRun({ text: `• ${h}` })] }));
      if (p.keywords.length) {
        out.push(new Paragraph({ children: [new TextRun({ text: `${I.keywords}${p.keywords.join(I.enumSep)}` })] }));
      }
      return out;
    }),
  );

  pushSection(
    T.skills,
    resume.skills.map((sk) =>
      new Paragraph({
        children: [new TextRun({ text: `${sk.name}${sk.level && sk.level !== "0" ? `（${sk.level}）` : ""}` })],
      }),
    ),
  );

  pushSection(
    T.education,
    resume.education.map((e) => {
      const sub = [e.studyType, e.area, e.score ? `GPA ${e.score}` : ""].filter(Boolean).join(I.groupSep);
      const meta = [e.startDate, e.endDate].filter(Boolean).join(" - ");
      return new Paragraph({
        children: [new TextRun({ text: `${e.institution}　|　${[sub, meta].filter(Boolean).join("　|　")}` })],
      });
    }),
  );

  pushSection(
    T.awards,
    resume.awards.map((a) => {
      const parts = [a.title, a.issuer, a.date].filter(Boolean).join(I.groupSep);
      return new Paragraph({ children: [new TextRun({ text: parts })] });
    }),
  );

  const langs = (resume as Record<string, unknown>)["x-meta"] as { languages?: string[] } | undefined;
  if (langs?.languages?.length) {
    pushSection(T.languages, [new Paragraph({ children: [new TextRun({ text: langs.languages.join(I.enumSep) })] })]);
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
