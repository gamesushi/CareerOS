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
