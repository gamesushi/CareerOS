import { describe, it, expect } from "vitest";
import { jsonResume, resumeGenerateInput } from "../resume";

// 集成测试：简历 JSON schema 是多地区生成的输出契约，
// 尤其 x-jis（日本履歴書/職務経歴書扩展段）与 ResumeType 四类型。

describe("jsonResume · x-jis 日本扩展段", () => {
  it("接受完整履歴書 x-jis（furigana/birthDate/住所/免許資格）", () => {
    const r = jsonResume.safeParse({
      basics: { name: "山田太郎" },
      "x-jis": {
        furigana: "やまだ たろう",
        birthDate: "1990-04-01",
        address: "東京都渋谷区1-2-3",
        shiboudouki: "貴社の理念に共感し志望しました",
        menkyoShikaku: [{ name: "TOEIC 900", date: "2024-03" }],
      },
    });
    expect(r.success).toBe(true);
  });

  it("職務経歴書字段（shokumuYoyaku/jikoPR）与 ikaseruKeiken 默认 []", () => {
    const r = jsonResume.parse({ basics: { name: "x" }, "x-jis": { shokumuYoyaku: "要約", jikoPR: "PR" } });
    expect(r["x-jis"]?.ikaseruKeiken).toEqual([]);
    expect(r["x-jis"]?.menkyoShikaku).toEqual([]);
  });

  it("顶层数组字段缺省落为 []（work/projects/skills/education）", () => {
    const r = jsonResume.parse({ basics: { name: "x" } });
    expect(r.work).toEqual([]);
    expect(r.skills).toEqual([]);
  });
});

describe("jsonResume · skills 模型输出形状容错", () => {
  // 回归：生成时模型受事实包「熟练度80」影响，偶发把 level 写成数字，
  // 须按 mock 约定归一成中文文字，否则 11 条技能全部「Expected string, received number」。
  it("skill.level 为数字时归一成中文（≥80 精通 / ≥60 熟练 / 其余 掌握）", () => {
    const r = jsonResume.parse({
      basics: { name: "x" },
      skills: [
        { name: "Go", level: 95 },
        { name: "Rust", level: 70 },
        { name: "SQL", level: 40 },
      ],
    });
    expect(r.skills.map((s) => s.level)).toEqual(["精通", "熟练", "掌握"]);
  });

  it("skill.level 为字符串原样保留，数字 keywords 转字符串", () => {
    const r = jsonResume.parse({
      basics: { name: "x" },
      skills: [{ name: "React", level: "熟练", keywords: ["TS", 80] }],
    });
    expect(r.skills[0].level).toBe("熟练");
    expect(r.skills[0].keywords).toEqual(["TS", "80"]);
  });
});

describe("resumeGenerateInput · 多地区 ResumeType 契约", () => {
  it("默认 resumeType=zh、templateId=classic", () => {
    const r = resumeGenerateInput.parse({});
    expect(r.resumeType).toBe("zh");
    expect(r.templateId).toBe("classic");
    expect(r.emphasis).toEqual([]);
  });

  it("四种地区类型均被接受（CN/US/JP 双文书）", () => {
    for (const t of ["zh", "en", "ja_shokumu", "ja_rirekisho"] as const) {
      expect(resumeGenerateInput.safeParse({ resumeType: t }).success).toBe(true);
    }
  });

  it("未知类型被拒", () => {
    expect(resumeGenerateInput.safeParse({ resumeType: "fr" }).success).toBe(false);
  });
});
