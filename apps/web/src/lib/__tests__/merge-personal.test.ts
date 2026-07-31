import { describe, it, expect } from "vitest";
import type { JsonResume } from "@careeros/shared";
import { mergePersonalIntoResume } from "../merge-personal";

// 集成测试：共享个人档案（User + CareerProfile.personal）注入简历 JSON。
// 这是多地区简历生成的关键一环——JP 履歴書的 ふりがな/生年月日/住所/照片 都靠这里注入。

// 构造一个通过 jsonResume 形状的最小简历（测试只关心 basics / x-jis）。
function baseResume(overrides: Partial<JsonResume> = {}): JsonResume {
  return {
    basics: { name: "旧名字", email: "old@x.com", phone: "000", location: "旧城市" },
    work: [],
    projects: [],
    skills: [],
    education: [],
    awards: [],
    "x-warnings": [],
    ...overrides,
  } as JsonResume;
}

const emptyUser = { name: null, email: null, mobile: null, region: null, preferredCity: null };

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
