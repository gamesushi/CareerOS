import type { JsonResume } from "@careeros/shared";
import type { CareerProfile } from "@careeros/db";

export type ProfileLangData = {
  name?: string | null;
  headline?: string | null;
  summary?: string | null;
  preferredCity?: string | null;
  mobile?: string | null;
  address?: string | null;
};

export type PersonalRecord = {
  photo?: string | null;
  address?: string | null;
  furigana?: string | null;
  birthDate?: string | null;
  zh?: ProfileLangData;
  en?: ProfileLangData;
  ja?: ProfileLangData;
  [key: string]: unknown;
};

function asPersonal(p: unknown): PersonalRecord {
  if (p && typeof p === "object") return p as PersonalRecord;
  return {};
}

/** 根据 templateId 或 resumeType 推导语言类别（zh / en / ja） */
export function resolveTargetLang(resumeType?: string, templateId?: string): "zh" | "en" | "ja" {
  const tpl = templateId?.replace(/^openresume-/, "") ?? "";
  if (tpl === "ats" || resumeType === "en") return "en";
  if (tpl === "shokumu" || tpl === "rirekisho" || resumeType === "ja_shokumu" || resumeType === "ja_rirekisho") return "ja";
  return "zh";
}

/**
 * 把「共享个人档案」（User + CareerProfile.personal 语言标签页）合并进简历 JSON。
 * 档案为权威源：根据简历语言/模板自动切出 zh / en / ja 专属姓名、头衔、摘要与联系方式。
 */
export function mergePersonalIntoResume(
  resume: JsonResume & { templateId?: string; resumeType?: string },
  user: { name?: string | null; email?: string | null; mobile?: string | null; region?: string | null; preferredCity?: string | null },
  profile: Pick<CareerProfile, "headline" | "summary" | "personal"> | null,
): JsonResume {
  const p = asPersonal(profile?.personal);
  const b = resume.basics ?? ({} as JsonResume["basics"]);
  const targetLang = resolveTargetLang(resume.resumeType, resume.templateId);
  const langData = p[targetLang] as ProfileLangData | undefined;

  // 档案为权威源：
  // 1. 如果 p.photo 为 null 或 ""，说明用户在个人设置中显式删除了照片 -> 彻底移除照片
  // 2. 如果 p.photo 为非空字符串，用 p.photo 覆盖
  // 3. 如果 p.photo 为 undefined（未在档案中配置过），降级保留简历原有的 b.photo
  let photo: string | undefined;
  if (p.photo === null || p.photo === "") {
    photo = undefined;
  } else if (p.photo !== undefined) {
    photo = p.photo;
  } else {
    photo = b.photo || undefined;
  }

  const rawAddress = langData?.address || p.address;
  let address: string | undefined;
  if (rawAddress === null || rawAddress === "") {
    address = undefined;
  } else if (rawAddress !== undefined) {
    address = rawAddress;
  } else {
    address = b.address || undefined;
  }

  // zh 档案：User 表本身就是中文权威源，优先级 langData > user > b
  // en/ja 档案：langData > b > user（简历翻译内容优先于 user 表的中文值）
  const isZh = targetLang === "zh";

  const name = langData?.name || (isZh ? (user.name || b.name) : (b.name || user.name)) || "";
  const email = isZh ? (user.email || b.email || "") : (b.email || user.email || "");
  const phone = langData?.mobile || (isZh ? (user.mobile || b.phone) : (b.phone || user.mobile)) || "";
  const location =
    langData?.preferredCity ||
    (isZh ? (user.preferredCity || user.region || b.location) : (b.location || user.preferredCity || user.region)) ||
    "";
  const label =
    langData?.headline ||
    (isZh ? (profile?.headline || b.label) : (b.label || profile?.headline)) ||
    "";
  const summary =
    langData?.summary ||
    (isZh ? (profile?.summary || b.summary) : (b.summary || profile?.summary)) ||
    "";

  const basics: JsonResume["basics"] = {
    ...b,
    name,
    email,
    phone,
    location,
    label,
    summary,
  };

  if (photo) basics.photo = photo;
  else delete (basics as Record<string, unknown>).photo;

  if (address) basics.address = address;
  else delete (basics as Record<string, unknown>).address;

  const jis = { ...(resume["x-jis"] as Record<string, unknown> | undefined) };
  if (p.furigana) jis.furigana = p.furigana;
  if (p.birthDate) jis.birthDate = p.birthDate;
  if (address) jis.address = address;

  return {
    ...resume,
    basics,
    ...(Object.keys(jis).length ? { "x-jis": jis as JsonResume["x-jis"] } : {}),
  };
}
