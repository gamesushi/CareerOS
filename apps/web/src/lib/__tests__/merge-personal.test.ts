import { describe, it, expect } from "vitest";
import type { JsonResume } from "@careeros/shared";
import { mergePersonalIntoResume, resolveTargetLang } from "../merge-personal";

// 集成测试：共享个人档案（User + CareerProfile.personal）注入简历 JSON。
// 这是多地区简历生成的关键一环——JP 履歴書的 ふりがな/生年月日/住所/照片 都靠这里注入。
// 新增多语言标签页（zh/en/ja）切换测试。

// 构造一个通过 jsonResume 形状的最小简历（测试只关心 basics / x-jis）。
function baseResume(overrides: Partial<JsonResume & { templateId?: string; resumeType?: string }> = {}): JsonResume & { templateId?: string; resumeType?: string } {
  return {
    basics: { name: "旧名字", email: "old@x.com", phone: "000", location: "旧城市", profiles: [] },
    work: [],
    projects: [],
    skills: [],
    education: [],
    awards: [],
    "x-warnings": [],
    ...overrides,
  } as JsonResume & { templateId?: string; resumeType?: string };
}

const emptyUser = { name: null, email: null, mobile: null, region: null, preferredCity: null };

describe("resolveTargetLang · 模板/类型 → 语言推导", () => {
  it("中文模板（classic/modern/sidebar/compact）→ zh", () => {
    expect(resolveTargetLang("zh", "classic")).toBe("zh");
    expect(resolveTargetLang("zh", "modern")).toBe("zh");
    expect(resolveTargetLang(undefined, "sidebar")).toBe("zh");
  });
  it("ATS 模板或 en 类型 → en", () => {
    expect(resolveTargetLang("en", "ats")).toBe("en");
    expect(resolveTargetLang("en", undefined)).toBe("en");
    expect(resolveTargetLang(undefined, "ats")).toBe("en");
  });
  it("職務経歴書/履歴書 模板或 ja_ 类型 → ja", () => {
    expect(resolveTargetLang("ja_shokumu", "shokumu")).toBe("ja");
    expect(resolveTargetLang("ja_rirekisho", "rirekisho")).toBe("ja");
    expect(resolveTargetLang("ja_shokumu", undefined)).toBe("ja");
  });
});

describe("mergePersonalIntoResume · 档案为权威源", () => {
  it("User 字段覆盖简历自身残留值", () => {
    const out = mergePersonalIntoResume(
      baseResume(),
      { name: "新名字", email: "new@x.com", mobile: "138", region: "上海", preferredCity: "北京" },
      { headline: "高级产品经理", summary: "十年经验", personal: {} },
    );
    expect(out.basics.name).toBe("新名字");
    expect(out.basics.email).toBe("new@x.com");
    expect(out.basics.phone).toBe("138");
    expect(out.basics.label).toBe("高级产品经理");
    expect(out.basics.summary).toBe("十年经验");
  });

  it("location 优先级：preferredCity > region > 简历原值", () => {
    expect(
      mergePersonalIntoResume(baseResume(), { ...emptyUser, preferredCity: "北京", region: "上海" }, null).basics
        .location,
    ).toBe("北京");
    expect(
      mergePersonalIntoResume(baseResume(), { ...emptyUser, region: "上海" }, null).basics.location,
    ).toBe("上海");
    expect(mergePersonalIntoResume(baseResume(), emptyUser, null).basics.location).toBe("旧城市");
  });

  it("User/档案为空时保留简历自身残留值（历史数据不丢）", () => {
    const out = mergePersonalIntoResume(baseResume(), emptyUser, null);
    expect(out.basics.name).toBe("旧名字");
    expect(out.basics.email).toBe("old@x.com");
    expect(out.basics.phone).toBe("000");
  });

  it("当个人设置中显式清空照片（photo 为 null 或空字符串）时，简历中的照片被移除", () => {
    const resumeWithPhoto = baseResume({
      basics: { ...baseResume().basics, name: "张三", photo: "http://example.com/old-photo.jpg" },
    });
    const out = mergePersonalIntoResume(resumeWithPhoto, emptyUser, {
      headline: null,
      summary: null,
      personal: { photo: null },
    });
    expect(out.basics.photo).toBeUndefined();
  });
});

describe("mergePersonalIntoResume · 多语言标签页切换", () => {
  const profile = {
    headline: "中文头衔",
    summary: "中文简介",
    personal: {
      photo: null,
      address: "中文地址",
      zh: { name: "何北航", headline: "中文头衔", summary: "中文简介", preferredCity: "北京", mobile: "13800000000", address: "北京朝阳区" },
      en: { name: "Beihang He", headline: "Growth Strategist", summary: "9+ years experience", preferredCity: "Tokyo", mobile: "+81-80-9619-4237", address: "Tokyo, Japan" },
      ja: { name: "何 北航", headline: "グロース戦略家", summary: "9年以上の経験", preferredCity: "東京", mobile: "080-9619-4237", address: "東京都渋谷区" },
    },
  };

  it("中文模板 → 读取 zh 标签页数据", () => {
    const out = mergePersonalIntoResume(
      baseResume({ templateId: "classic" }),
      emptyUser,
      profile,
    );
    expect(out.basics.name).toBe("何北航");
    expect(out.basics.label).toBe("中文头衔");
    expect(out.basics.summary).toBe("中文简介");
    expect(out.basics.location).toBe("北京");
  });

  it("ATS 英文模板 → 读取 en 标签页数据", () => {
    const out = mergePersonalIntoResume(
      baseResume({ templateId: "ats", resumeType: "en" }),
      emptyUser,
      profile,
    );
    expect(out.basics.name).toBe("Beihang He");
    expect(out.basics.label).toBe("Growth Strategist");
    expect(out.basics.summary).toBe("9+ years experience");
    expect(out.basics.location).toBe("Tokyo");
    expect(out.basics.phone).toBe("+81-80-9619-4237");
  });

  it("日文職務経歴書模板 → 读取 ja 标签页数据", () => {
    const out = mergePersonalIntoResume(
      baseResume({ templateId: "shokumu", resumeType: "ja_shokumu" }),
      emptyUser,
      profile,
    );
    expect(out.basics.name).toBe("何 北航");
    expect(out.basics.label).toBe("グロース戦略家");
    expect(out.basics.summary).toBe("9年以上の経験");
    expect(out.basics.location).toBe("東京");
    expect(out.basics.address).toBe("東京都渋谷区");
  });

  it("en 标签页为空时，降级用 b（简历原值）或 user", () => {
    const out = mergePersonalIntoResume(
      baseResume({ templateId: "ats", resumeType: "en" }),
      { name: "fallback", email: "f@x.com", mobile: "999", region: null, preferredCity: null },
      { headline: null, summary: null, personal: { en: {} } },
    );
    // en 模式下 b.phone（简历翻译内容）优先于 user.mobile（中文用户表值）
    expect(out.basics.name).toBe("旧名字");
    expect(out.basics.phone).toBe("000");
  });
});

describe("mergePersonalIntoResume · JP 履歴書 x-jis 注入", () => {
  it("furigana/birthDate/address 注入 x-jis，address 同时进 basics", () => {
    const out = mergePersonalIntoResume(baseResume(), emptyUser, {
      headline: null,
      summary: null,
      personal: {
        furigana: "やまだ たろう",
        birthDate: "1990-04-01",
        address: "東京都渋谷区1-2-3",
        photo: "data:image/png;base64,AAAA",
      },
    });
    const jis = out["x-jis"] as Record<string, unknown>;
    expect(jis.furigana).toBe("やまだ たろう");
    expect(jis.birthDate).toBe("1990-04-01");
    expect(jis.address).toBe("東京都渋谷区1-2-3");
    expect(out.basics.address).toBe("東京都渋谷区1-2-3");
    expect(out.basics.photo).toBe("data:image/png;base64,AAAA");
  });

  it("无任何 jis 字段且简历原本无 x-jis 时，不产出 x-jis 键", () => {
    const out = mergePersonalIntoResume(baseResume(), emptyUser, { headline: null, summary: null, personal: {} });
    expect("x-jis" in out).toBe(false);
  });

  it("简历已有 x-jis（如職務要約）时，即使无个人 jis 字段也保留原 x-jis", () => {
    const resume = baseResume({ "x-jis": { shokumuYoyaku: "10年のPM経験", ikaseruKeiken: [], menkyoShikaku: [] } });
    const out = mergePersonalIntoResume(resume, emptyUser, { headline: null, summary: null, personal: {} });
    const jis = out["x-jis"] as Record<string, unknown>;
    expect(jis.shokumuYoyaku).toBe("10年のPM経験");
  });
});
