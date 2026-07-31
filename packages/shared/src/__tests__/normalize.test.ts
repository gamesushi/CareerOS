import { describe, it, expect } from "vitest";
import { normalizeSkill, normalizeCompany } from "../normalize";

// 集成测试：归一化是查重与匹配打分的共同基础（jobMatch 的技能命中直接依赖 normalizeSkill）。

describe("normalizeSkill · 别名归一 + 大小写/空白清洗", () => {
  it.each([
    ["JS", "javascript"],
    ["  TS  ", "typescript"],
    ["Postgres", "postgresql"],
    ["React.js", "react"],
    ["K8s", "kubernetes"],
    ["Node", "nodejs"],
    ["GCP", "google cloud"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSkill(input)).toBe(expected);
  });

  it("未知技能：仅做小写+trim 透传，不误改", () => {
    expect(normalizeSkill("  GoLang ")).toBe("golang");
    expect(normalizeSkill("Rust")).toBe("rust");
  });
});

describe("normalizeCompany · 去公司后缀（中/英/日）", () => {
  it.each([
    ["腾讯有限公司", "腾讯"],
    ["Acme Inc.", "acme"],
    ["Globex Corp", "globex"],
    ["Initech LLC", "initech"],
    ["メルカリ株式会社", "メルカリ"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeCompany(input)).toBe(expected);
  });

  it("同一公司不同写法归一后一致（查重前提）", () => {
    expect(normalizeCompany("字节跳动有限公司")).toBe(normalizeCompany("字节跳动"));
  });
});
