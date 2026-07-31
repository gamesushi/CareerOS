import { describe, it, expect } from "vitest";
import { jdParsed, MATCH_WEIGHTS, SKILL_SIM_THRESHOLD, EXP_SIM_FULL, EXP_SIM_ZERO } from "../jd";

// 集成测试：JD 解析契约与打分常量是 jobMatch 打分的输入基础，
// 契约默认值/不变量一旦漂移，匹配分数会静默错位。

describe("jdParsed · schema 默认值契约", () => {
  it("skills 条目 required 默认 true、weight 默认 3", () => {
    const r = jdParsed.parse({ skills: [{ name: "Go" }] });
    expect(r.skills[0]).toMatchObject({ name: "Go", required: true, weight: 3 });
  });

  it("缺省数组字段全部落为 []（experience/industry/keywords/languages）", () => {
    const r = jdParsed.parse({});
    expect(r.skills).toEqual([]);
    expect(r.experience).toEqual([]);
    expect(r.industry).toEqual([]);
    expect(r.keywords).toEqual([]);
    expect(r.languages).toEqual([]);
  });

  it("非法 weight（越界/非整数）被拒", () => {
    expect(jdParsed.safeParse({ skills: [{ name: "Go", weight: 9 }] }).success).toBe(false);
    expect(jdParsed.safeParse({ skills: [{ name: "Go", weight: 2.5 }] }).success).toBe(false);
  });

  it("接受 languages 用于地区推断（多地区路由依赖）", () => {
    const r = jdParsed.parse({ languages: ["日本語", "English"], location: "Tokyo" });
    expect(r.languages).toEqual(["日本語", "English"]);
    expect(r.location).toBe("Tokyo");
  });
});

describe("打分常量 · 不变量", () => {
  it("三路权重之和为 1（jobMatch 剔除维度后重归一化的前提）", () => {
    expect(MATCH_WEIGHTS.skill + MATCH_WEIGHTS.experience + MATCH_WEIGHTS.industry).toBeCloseTo(1, 10);
  });

  it("经历相似度阈值：ZERO < FULL 且均在 (0,1)", () => {
    expect(EXP_SIM_ZERO).toBeLessThan(EXP_SIM_FULL);
    expect(EXP_SIM_ZERO).toBeGreaterThan(0);
    expect(EXP_SIM_FULL).toBeLessThan(1);
  });

  it("技能向量兜底阈值在 (0,1)", () => {
    expect(SKILL_SIM_THRESHOLD).toBeGreaterThan(0);
    expect(SKILL_SIM_THRESHOLD).toBeLessThan(1);
  });
});
