import type { JsonResume } from "@careeros/shared";
import { titlesFor, inlineLabels } from "../pdf/titles";

// 简历 JSON → Markdown（纯文本，通用结构化，不绑定模板视觉）。
// 标题/内联文案按简历语言（resumeType）本地化，英文/日文简历不再出现中文分区名。

const esc = (s: string | undefined | null): string => (s ?? "").replace(/\|/g, "\\|").trim();

export function resumeToMarkdown(resume: JsonResume, lang?: string): string {
  const b = resume.basics;
  const T = titlesFor(lang);
  const I = inlineLabels(lang);
  const L: string[] = [];

  L.push(`# ${esc(b.name) || I.fallbackName}`);
  if (b.label) L.push(`> ${esc(b.label)}`);
  const contact = [b.email, b.phone, b.location, b.url].filter(Boolean).map(esc).join("  ·  ");
  if (contact) L.push(contact);

  if (b.summary) {
    L.push("", `## ${T.summary}`, esc(b.summary));
  }

  const section = (title: string, items: string[]) => {
    if (items.length === 0) return;
    L.push("", `## ${title}`, ...items);
  };

  section(
    T.work,
    resume.work.map((w) => {
      const head = `### ${esc(w.position)}${w.name ? `, ${esc(w.name)}` : ""}${
        w.startDate ? `（${esc(w.startDate)} - ${esc(w.endDate) || I.present}）` : ""
      }`;
      const lines = [head];
      if (w.summary) lines.push(esc(w.summary));
      for (const h of w.highlights) lines.push(`- ${esc(h)}`);
      return lines.join("\n");
    }),
  );

  section(
    T.projects,
    resume.projects.map((p) => {
      const head = `### ${esc(p.name)}${p.roles.length ? `（${p.roles.map(esc).join(I.enumSep)}）` : ""}`;
      const lines = [head];
      if (p.description) lines.push(esc(p.description));
      for (const h of p.highlights) lines.push(`- ${esc(h)}`);
      if (p.keywords.length) lines.push(`${I.keywords}${p.keywords.map(esc).join(I.enumSep)}`);
      return lines.join("\n");
    }),
  );

  section(
    T.skills,
    resume.skills.map((sk) => `- ${esc(sk.name)}${sk.level && sk.level !== "0" ? `（${esc(sk.level)}）` : ""}`),
  );

  section(
    T.education,
    resume.education.map((e) => {
      const head = `### ${esc(e.institution)}`;
      const sub = [e.studyType, e.area, e.score ? `GPA ${esc(e.score)}` : ""].filter(Boolean).map(esc).join(I.groupSep);
      const meta = [e.startDate, e.endDate].filter(Boolean).map(esc).join(" - ");
      return [head, sub, meta].filter(Boolean).join("　|　");
    }),
  );

  section(
    T.awards,
    resume.awards.map((a) => {
      const parts = [a.title, a.issuer, a.date].filter(Boolean).map(esc);
      return `- ${parts.join(I.groupSep)}`;
    }),
  );

  const langs = (resume as Record<string, unknown>)["x-meta"] as { languages?: string[] } | undefined;
  if (langs?.languages?.length) {
    L.push("", `## ${T.languages}`, langs.languages.map(esc).join(I.enumSep));
  }

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
