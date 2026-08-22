import { describe, expect, it } from "vitest";
import {
  dateOverlap,
  companyRelated,
  buildCandidatePairs,
  mergeFields,
  buildApplyExperiences,
  type DupHit,
  type ExpFields,
} from "../dedup";

const E = (over: Partial<ExpFields> = {}): ExpFields => ({
  company: "网易游戏",
  title: "研究员",
  startDate: "2019-09-01",
  endDate: "2021-11-01",
  location: null,
  description: null,
  highlights: [],
  ...over,
});

describe("dateOverlap", () => {
  it("重叠区间判 true", () => {
    expect(dateOverlap(E({ startDate: "2019-09", endDate: "2021-11" }), E({ startDate: "2020-01", endDate: "2022-01" }))).toBe(true);
  });
  it("先后顺序不重叠判 false", () => {
    expect(dateOverlap(E({ startDate: "2015-01", endDate: "2019-01" }), E({ startDate: "2019-09", endDate: "2021-11" }))).toBe(false);
  });
  it("一端为至今(null) 视为开放区间，重叠", () => {
    expect(dateOverlap(E({ startDate: "2019-09", endDate: null }), E({ startDate: "2020-01", endDate: "2021-11" }))).toBe(true);
  });
});

describe("companyRelated", () => {
  it("归一化完全相同的公司名", () => {
    expect(companyRelated("网易游戏", "网易游戏")).toBe(true);
  });
  it("长名完整包含短名", () => {
    expect(companyRelated("腾讯科技（深圳）有限公司", "腾讯科技")).toBe(true);
    expect(companyRelated("中国民生银行总行", "中国民生银行")).toBe(true);
  });
  it("英文别名整词相同", () => {
    expect(companyRelated("NetEase Games", "NetEase")).toBe(true);
  });
  it("不同公司不应判相关", () => {
    expect(companyRelated("腾讯科技", "网易科技")).toBe(false);
    expect(companyRelated("字节跳动", "网易游戏")).toBe(false);
  });
});

describe("buildCandidatePairs", () => {
  it("导入内同一公司+时间重叠 → intra 候选", () => {
    const exps = [
      E({ company: "网易游戏", title: "高级研究员", startDate: "2019-09", endDate: "2021-11" }),
      E({ company: "网易游戏", title: "研究员（用户体验中心）", startDate: "2019-09", endDate: "2021-11" }),
    ];
    const pairs = buildCandidatePairs(exps, []);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe("intra");
    expect(pairs[0].otherIndex).toBe(1);
  });
  it("不同公司不生成候选", () => {
    const exps = [
      E({ company: "网易游戏" }),
      E({ company: "腾讯科技" }),
    ];
    expect(buildCandidatePairs(exps, [])).toHaveLength(0);
  });
  it("跨导入：已入库同名同时间 → cross 候选", () => {
    const exps = [E({ company: "网易游戏", startDate: "2019-09", endDate: "2021-11" })];
    const existing = [{ id: "rec-1", company: "网易游戏", title: "研究员", startDate: "2019-09-01", endDate: "2021-11-01", location: null, description: null, highlights: [] }];
    const pairs = buildCandidatePairs(exps, existing);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe("cross");
    expect(pairs[0].existingId).toBe("rec-1");
  });
});

describe("mergeFields", () => {
  it("保留更长描述、合并亮点、取更早开始与更晚结束", () => {
    const a = E({ description: "短描述", highlights: ["甲", "乙"], startDate: "2019-09-01", endDate: "2021-06-01" });
    const b = E({ description: "这是一段更长的描述内容", highlights: ["乙", "丙"], startDate: "2019-10-01", endDate: "2021-11-01" });
    const m = mergeFields(a, b);
    expect(m.description).toBe("这是一段更长的描述内容");
    expect(m.highlights).toEqual(["甲", "乙", "丙"]);
    expect(m.startDate).toBe("2019-09-01");
    expect(m.endDate).toBe("2021-11-01");
  });
  it("任一端为至今(null) → 合并后仍为至今", () => {
    const m = mergeFields(E({ endDate: null }), E({ endDate: "2021-11-01" }));
    expect(m.endDate).toBeNull();
  });
});

describe("buildApplyExperiences", () => {
  const mkHit = (over: Partial<DupHit> = {}): DupHit => ({
    id: "cross:0:rec-1",
    index: 0,
    kind: "cross",
    existingId: "rec-1",
    same: true,
    confidence: "high",
    ...over,
  });

  it("cross merge → 生成 update 操作（不新建）", () => {
    const exps = [E({ company: "网易游戏", title: "研究员" })];
    const { ops, dropped } = buildApplyExperiences(exps, [mkHit()], { "cross:0:rec-1": "merge" });
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("update");
    if (ops[0].type === "update") expect(ops[0].id).toBe("rec-1");
    expect(dropped).toHaveLength(0);
  });

  it("cross keep_existing → 丢弃新经历", () => {
    const exps = [E({ company: "网易游戏", title: "研究员" })];
    const { ops } = buildApplyExperiences(exps, [mkHit()], { "cross:0:rec-1": "keep_existing" });
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("drop");
  });

  it("cross keep_both → 正常新建（且标记 forceCreate 以绕过竞态兜底）", () => {
    const exps = [E({ company: "网易游戏", title: "研究员" })];
    const { ops } = buildApplyExperiences(exps, [mkHit()], { "cross:0:rec-1": "keep_both" });
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("create");
    if (ops[0].type === "create") expect(ops[0].forceCreate).toBe(true);
  });

  it("intra merge → 一条 create + 另一条 drop", () => {
    const exps = [
      E({ company: "网易游戏", title: "高级研究员", startDate: "2019-09", endDate: "2021-11" }),
      E({ company: "网易游戏", title: "研究员（用户体验中心）", startDate: "2019-09", endDate: "2021-11" }),
    ];
    const hit: DupHit = { id: "intra:0:1", index: 0, kind: "intra", otherIndex: 1, same: true, confidence: "high" };
    const { ops, dropped } = buildApplyExperiences(exps, [hit], { "intra:0:1": "merge" });
    expect(ops.filter((o) => o.type === "create")).toHaveLength(1);
    expect(dropped).toContain(1);
  });

  it("未命中查重的经历遵循 include 开关", () => {
    const exps = [E({ company: "腾讯科技" }), E({ company: "字节跳动" })];
    const { ops } = buildApplyExperiences(exps, [], {}, [true, false]);
    expect(ops.filter((o) => o.type === "create")).toHaveLength(1);
  });
});
