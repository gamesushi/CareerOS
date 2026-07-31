import type { JsonResume } from "@careeros/shared";
import type { CareerProfile } from "@careeros/db";

type PersonalRecord = {
  photo?: string | null;
  address?: string | null;
  furigana?: string | null;
  birthDate?: string | null;
};

function asPersonal(p: unknown): PersonalRecord {
  if (p && typeof p === "object") return p as PersonalRecord;
  return {};
}

/**
 * 把「共享个人档案」（User + CareerProfile.personal）合并进简历 JSON。
 * 档案为权威源：优先用档案值；简历自身残留值作为兜底，保证历史数据不丢。
 * 所有简历共用同一档案，因此在档案页改一次、全部简历导出同步生效。
 */
export function mergePersonalIntoResume(
  resume: JsonResume,
  user: { name?: string | null; email?: string | null; mobile?: string | null; region?: string | null; preferredCity?: string | null },
  profile: Pick<CareerProfile, "headline" | "summary" | "personal"> | null,
): JsonResume {
  const p = asPersonal(profile?.personal);
  const b = resume.basics ?? ({} as JsonResume["basics"]);

  const basics = {
    ...b,
    name: user.name || b.name,
    email: user.email || b.email,
    phone: user.mobile || b.phone,
    location: user.preferredCity || user.region || b.location,
    label: profile?.headline || b.label,
    summary: profile?.summary || b.summary,
    photo: p.photo || b.photo,
    address: p.address || b.address,
  };

  const jis = { ...(resume["x-jis"] as Record<string, unknown> | undefined) };
  if (p.furigana) jis.furigana = p.furigana;
  if (p.birthDate) jis.birthDate = p.birthDate;
  if (p.address) jis.address = p.address;

  return {
    ...resume,
    basics,
    ...(Object.keys(jis).length ? { "x-jis": jis as JsonResume["x-jis"] } : {}),
  };
}
