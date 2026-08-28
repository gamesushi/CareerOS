import React from "react";
import { Image, Text, View } from "@react-pdf/renderer";
import type { JsonResume } from "@careeros/shared";

// 模板公共约定：每个模板导出 ({ resume, lang, accent }) => <Document>。
// 文案 i18n 与小部件在此共享。

export type TemplateProps = {
  resume: JsonResume;
  lang?: string;
  accent?: string;
};

// 分区标题与内联文案的本地化字典集中在 lib/pdf/titles.ts（PDF / Markdown / Doc / Docx 共用），
// 此处重新导出以保持模板对 common 的既有导入路径不变。
export { SECTION_TITLES, titlesFor } from "./titles";

export const range = (start?: string, end?: string, presentLabel?: string, lang?: string) => {
  if (!start && !end) return "";
  let p = presentLabel;
  if (!p || p === "至今") {
    p = lang === "en" ? "Present" : lang?.startsWith("ja") ? "現在" : "至今";
  }
  return `${start ?? ""} ~ ${end || p}`;
};

export const contactLine = (b: JsonResume["basics"]) =>
  [b.email, b.phone, b.location, b.url].filter(Boolean).join("  ·  ");

export function Bullets({
  items,
  color = "#1a1a1a",
  size = 9.5,
}: {
  items: string[];
  color?: string;
  size?: number;
}) {
  return (
    <>
      {items.map((h, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: 2 }}>
          <Text style={{ width: 10, color, fontSize: size }}>•</Text>
          <Text style={{ flex: 1, color, fontSize: size }}>{h}</Text>
        </View>
      ))}
    </>
  );
}

/** 简历各分区是否有内容 */
export const has = (resume: JsonResume) => ({
  work: resume.work.length > 0,
  projects: resume.projects.length > 0,
  skills: resume.skills.length > 0,
  education: resume.education.length > 0,
  awards: resume.awards.length > 0,
});

/** 个人照片缩略图：有 photo 时才渲染（data URL 直接喂给 react-pdf Image） */
export function PhotoThumb({
  src,
  size = 44,
  radius = 4,
}: {
  src?: string;
  size?: number;
  radius?: number;
}) {
  if (!src) return null;
  return (
    <Image
      src={src}
      fixed
      style={{ width: size, height: size, borderRadius: radius, objectFit: "cover" }}
    />
  );
}
