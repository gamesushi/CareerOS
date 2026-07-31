import type { JsonResume } from "@careeros/shared";

// 简历 JSON → Markdown（纯文本，通用结构化，不绑定模板视觉）。

const esc = (s: string | undefined | null): string => (s ?? "").replace(/\|/g, "\\|").trim();

export function resumeToMarkdown(resume: JsonResume): string {
  const b = resume.basics;
  const L: string[] = [];

  L.push(`# ${esc(b.name) || "简历"}`);
  if (b.label) L.push(`> ${esc(b.label)}`);
  const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).map(esc).join("  ·  ");
  if (contact) L.push(contact);

  if (b.summary) {
    L.push("", "## 个人综述", esc(b.summary));
  }

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    L.push("", `## ${title}`, ...items);
  };

  section(
    "工作经历",
    resume.work.map((w) => {
      const head = `### ${esc(w.position)}${w.name ? `, ${esc(w.name)}` : ""}${
        w.startDate ? `（${esc(w.startDate)} - ${esc(w.endDate) || "至今"}）` : ""
      }`;
      const lines = [head];
      if (w.summary) lines.push(esc(w.summary));
      for (const h of w.highlights) lines.push(`- ${esc(h)}`);
      return lines.join("\n");
    }),
  );

  section(
    "项目经历",
    resume.projects.map((p) => {
      const head = `### ${esc(p.name)}${p.roles.length ? `（${p.roles.map(esc).join("、")}）` : ""}`;
      const lines = [head];
      if (p.description) lines.push(esc(p.description));
      for (const h of p.highlights) lines.push(`- ${esc(h)}`);
      if (p.keywords.length) lines.push(`关键词：${p.keywords.map(esc).join("、")}`);
      return lines.join("\n");
    }),
  );

  section(
    "技能",
    resume.skills.map((sk) => `- ${esc(sk.name)}${sk.level && sk.level !== "0" ? `（${esc(sk.level)}）` : ""}`),
  );

  section(
    "教育经历",
    resume.education.map((e) => {
      const head = `### ${esc(e.institution)}`;
      const sub = [e.studyType, e.area, e.score ? `GPA ${esc(e.score)}` : ""].filter(Boolean).map(esc).join("，");
      const meta = [e.startDate, e.endDate].filter(Boolean).map(esc).join(" - ");
      return [head, sub, meta].filter(Boolean).join("　|　");
    }),
  );

  section(
    "主要成果",
    resume.awards.map((a) => {
      const parts = [a.title, a.issuer, a.date].filter(Boolean).map(esc);
      return `- ${parts.join("，")}`;
    }),
  );

  const langs = (resume as Record<string, unknown>)["x-meta"] as { languages?: string[] } | undefined;
  if (langs?.languages?.length) {
    L.push("", "## 语言能力", langs.languages.map(esc).join("　·　"));
  }

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
