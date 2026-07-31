import type { JsonResume } from "@careeros/shared";
import { resumeToMarkdown } from "./markdown";

// 简历 JSON → .doc（Word 可直接打开的 HTML 包装，MIME application/msword）。
// 不绑定模板视觉，结构与 PDF/Markdown 一致。

const esc = (s: string | undefined | null): string =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function resumeToDoc(resume: JsonResume): string {
  const b = resume.basics;
  const rows: string[] = [];

  rows.push(`<h1>${esc(b.name)}</h1>`);
  if (b.label) rows.push(`<p><strong>${esc(b.label)}</strong></p>`);
  const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).map(esc).join("　·　");
  if (contact) rows.push(`<p>${contact}</p>`);
  if (b.summary) rows.push(`<h2>个人综述</h2><p>${esc(b.summary)}</p>`);

  const section = (title: string, body: string) => {
    if (body) rows.push(`<h2>${esc(title)}</h2>${body}`);
  };

  section(
    "工作经历",
    resume.work
      .map((w) => {
        const head = `<p><strong>${esc(w.position)}${w.name ? `, ${esc(w.name)}` : ""}${
          w.startDate ? `（${esc(w.startDate)} - ${esc(w.endDate) || "至今"}）` : ""
        }</strong></p>`;
        const sub = [w.summary, ...w.highlights.map((h) => `· ${h}`)].filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("");
        return head + sub;
      })
      .join(""),
  );

  section(
    "项目经历",
    resume.projects
      .map((p) => {
        const head = `<p><strong>${esc(p.name)}${p.roles.length ? `（${p.roles.map(esc).join("、")}）` : ""}</strong></p>`;
        const sub = [p.description, ...p.highlights.map((h) => `· ${h}`)].filter(Boolean).map((x) => `<p>${esc(x)}</p>`).join("");
        return head + sub;
      })
      .join(""),
  );

  section(
    "技能",
    `<p>${resume.skills
      .map((sk) => esc(sk.name) + (sk.level && sk.level !== "0" ? `（${esc(sk.level)}）` : ""))
      .join("　·　")}</p>`,
  );

  section(
    "教育经历",
    resume.education
      .map((e) => {
        const sub = [e.studyType, e.area, e.score ? `GPA ${esc(e.score)}` : ""].filter(Boolean).map(esc).join("，");
        const meta = [e.startDate, e.endDate].filter(Boolean).map(esc).join(" - ");
        return `<p><strong>${esc(e.institution)}</strong>　|　${[sub, meta].filter(Boolean).join("　|　")}</p>`;
      })
      .join(""),
  );

  section(
    "主要成果",
    `<p>${resume.awards
      .map((a) => [a.title, a.issuer, a.date].filter(Boolean).map(esc).join("，"))
      .join("；")}</p>`,
  );

  const langs = (resume as Record<string, unknown>)["x-meta"] as { languages?: string[] } | undefined;
  if (langs?.languages?.length) {
    rows.push(`<h2>语言能力</h2><p>${langs.languages.map(esc).join("　·　")}</p>`);
  }

  // 同时兜底：若上面拼接为空，至少给出 markdown 文本，保证文件不为空。
  const body = rows.join("\n");
  const fallback = resumeToMarkdown(resume)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${esc(b.name)}</title></head>
<body>
${body || fallback}
</body>
</html>`;
}
