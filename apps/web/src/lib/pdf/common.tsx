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

export const SECTION_TITLES: Record<string, Record<string, string>> = {
  zh: { work: "工作经历", projects: "项目经历", skills: "技能", education: "教育经历", awards: "主要成果", summary: "个人综述" },
  en: { work: "Experience", projects: "Projects", skills: "Skills", education: "Education", awards: "Achievements", summary: "Summary" },
  ja_shokumu: { work: "職務経歴", projects: "プロジェクト", skills: "スキル", education: "学歴", awards: "主な実績", summary: "職務要約" },
};

export const titlesFor = (lang?: string) => SECTION_TITLES[lang ?? "zh"] ?? SECTION_TITLES.zh;

export const range = (start?: string, end?: string, presentLabel = "至今") =>
  start || end ? `${start ?? ""} ~ ${end || presentLabel}` : "";

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
