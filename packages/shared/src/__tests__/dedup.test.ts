import { describe, expect, it } from "vitest";
import {
  dateOverlap,
  companyRelated,
  SECTION_KINDS,
  toNewItems,
  toExistingItems,
  buildCandidatePairsForKind,
  mergeItems,
  sectionCandidate,
  buildApplySections,
  type DupHit,
  type MergeItem,
} from "../dedup";

// 工作经历原始字段袋（传给 toNewItems("work", ...)）
const W = (over: Record<string, any> = {}): Record<string, any> => ({
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
    expect(dateOverlap({ startDate: "2019-09", endDate: "2021-11" }, { startDate: "2020-01", endDate: "2022-01" })).toBe(true);
  });
  it("先后顺序不重叠判 false", () => {
    expect(dateOverlap({ startDate: "2015-01", endDate: "2019-01" }, { startDate: "2019-09", endDate: "2021-11" })).toBe(false);
  });
  it("一端为至今(null) 视为开放区间，重叠", () => {
    expect(dateOverlap({ startDate: "2019-09", endDate: null }, { startDate: "2020-01", endDate: "2021-11" })).toBe(true);
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

describe("SECTION_KINDS", () => {
  it("覆盖 5 类分栏", () => {
    expect(SECTION_KINDS).toEqual(["work", "project", "achievement", "education", "honor"]);
  });
});

describe("buildCandidatePairsForKind - work", () => {
  it("导入内同一公司+时间重叠 → intra 候选", () => {
    const items = toNewItems("work", [
      W({ company: "网易游戏", title: "高级研究员", startDate: "2019-09", endDate: "2021-11" }),
      W({ company: "网易游戏", title: "研究员（用户体验中心）", startDate: "2019-09", endDate: "2021-11" }),
    ]);
    const pairs = buildCandidatePairsForKind("work", items, []);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe("intra");
    expect(pairs[0].otherIndex).toBe(1);
  });
  it("不同公司不生成候选", () => {
    const items = toNewItems("work", [W({ company: "网易游戏" }), W({ company: "腾讯科技" })]);
    expect(buildCandidatePairsForKind("work", items, [])).toHaveLength(0);
  });
  it("跨导入：已入库同名同时间 → cross 候选", () => {
    const items = toNewItems("work", [W({ company: "网易游戏", startDate: "2019-09", endDate: "2021-11" })]);
    const existing = toExistingItems("work", [
      { id: "rec-1", company: "网易游戏", title: "研究员", startDate: "2019-09-01", endDate: "2021-11-01", location: null, description: null, highlights: [] },
    ]);
    const pairs = buildCandidatePairsForKind("work", items, existing);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe("cross");
    expect(pairs[0].existingId).toBe("rec-1");
  });
});

describe("mergeItems - work", () => {
  it("保留更长描述、合并亮点、取更早开始与更晚结束", () => {
    const a = toNewItems("work", [W({ description: "短描述", highlights: ["甲", "乙"], startDate: "2019-09-01", endDate: "2021-06-01" })])[0];
    const b = toNewItems("work", [W({ description: "这是一段更长的描述内容", highlights: ["乙", "丙"], startDate: "2019-10-01", endDate: "2021-11-01" })])[0];
    const m = mergeItems("work", a, b);
    expect(m.raw.description).toBe("这是一段更长的描述内容");
    expect(m.raw.highlights).toEqual(["甲", "乙", "丙"]);
    expect(m.startDate).toBe("2019-09-01");
    expect(m.endDate).toBe("2021-11-01");
  });
  it("任一端为至今(null) → 合并后仍为至今", () => {
    const a = toNewItems("work", [W({ endDate: null })])[0];
    const b = toNewItems("work", [W({ endDate: "2021-11-01" })])[0];
    const m = mergeItems("work", a, b);
    expect(m.endDate).toBeNull();
  });
});

describe("buildApplySections - work", () => {
  const mkHit = (over: Partial<DupHit> = {}): DupHit => ({
    id: "cross:0:rec-1",
    index: 0,
    kind: "cross",
    section: "work",
    existingId: "rec-1",
    same: true,
    confidence: "high",
    ...over,
  });

  it("cross merge → 生成 update 操作（不新建）", () => {
    const items = toNewItems("work", [W({ company: "网易游戏", title: "研究员" })]);
    const { work: { ops, dropped } } = buildApplySections([
      { kind: "work", items, hits: [mkHit()], choices: { "cross:0:rec-1": "merge" } },
    ]);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("update");
    if (ops[0].type === "update") expect(ops[0].id).toBe("rec-1");
    expect(dropped).toHaveLength(0);
  });

  it("cross keep_existing → 丢弃新经历", () => {
    const items = toNewItems("work", [W({ company: "网易游戏", title: "研究员" })]);
    const { work: { ops } } = buildApplySections([
      { kind: "work", items, hits: [mkHit()], choices: { "cross:0:rec-1": "keep_existing" } },
    ]);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("drop");
  });

  it("cross keep_both → 正常新建（且标记 forceCreate 以绕过竞态兜底）", () => {
    const items = toNewItems("work", [W({ company: "网易游戏", title: "研究员" })]);
    const { work: { ops } } = buildApplySections([
      { kind: "work", items, hits: [mkHit()], choices: { "cross:0:rec-1": "keep_both" } },
    ]);
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("create");
    if (ops[0].type === "create") expect(ops[0].forceCreate).toBe(true);
  });

  it("intra merge → 一条 create + 另一条 drop", () => {
    const items = toNewItems("work", [
      W({ company: "网易游戏", title: "高级研究员", startDate: "2019-09", endDate: "2021-11" }),
      W({ company: "网易游戏", title: "研究员（用户体验中心）", startDate: "2019-09", endDate: "2021-11" }),
    ]);
    const hit: DupHit = { id: "intra:0:1", index: 0, kind: "intra", section: "work", otherIndex: 1, same: true, confidence: "high" };
    const { work: { ops, dropped } } = buildApplySections([
      { kind: "work", items, hits: [hit], choices: { "intra:0:1": "merge" } },
    ]);
    expect(ops.filter((o) => o.type === "create")).toHaveLength(1);
    expect(dropped).toContain(1);
  });

  it("未命中查重的经历遵循 include 开关", () => {
    const items = toNewItems("work", [W({ company: "腾讯科技" }), W({ company: "字节跳动" })]);
    const { work: { ops } } = buildApplySections([
      { kind: "work", items, hits: [], choices: {}, include: [true, false] },
    ]);
    expect(ops.filter((o) => o.type === "create")).toHaveLength(1);
  });
});

describe("5 类分栏框架：education / honor 候选与合并", () => {
  it("education：同校+时间重叠 → 候选命中", () => {
    const items = toNewItems("education", [
      { school: "清华大学", degree: "本科", startDate: "2015-09", endDate: "2019-06" },
      { school: "清华大学", degree: "学士", startDate: "2015-09", endDate: "2019-06" },
    ]);
    const pairs = buildCandidatePairsForKind("education", items, []);
    expect(pairs).toHaveLength(1);
    expect(pairs[0].kind).toBe("intra");
  });

  it("education：不同学校不生成候选", () => {
    const items = toNewItems("education", [
      { school: "清华大学", degree: "本科", startDate: "2015-09", endDate: "2019-06" },
      { school: "北京大学", degree: "本科", startDate: "2015-09", endDate: "2019-06" },
    ]);
    expect(buildCandidatePairsForKind("education", items, [])).toHaveLength(0);
  });

  it("education merge：保留更长描述、合并时间区间", () => {
    const a = toNewItems("education", [
      { school: "清华大学", degree: "本科", major: "计算机", startDate: "2015-09", endDate: "2018-06", description: "短" },
    ])[0];
    const b = toNewItems("education", [
      { school: "清华大学", degree: "学士", major: "软件工程", startDate: "2015-09", endDate: "2019-06", description: "更长的描述内容" },
    ])[0];
    const m = mergeItems("education", a, b);
    expect(m.raw.description).toBe("更长的描述内容");
    expect(m.endDate).toBe("2019-06");
  });

  it("honor：同标题+同颁发方 → 候选命中", () => {
    const items = toNewItems("honor", [
      { title: "优秀员工", issuer: "公司", date: "2021" },
      { title: "优秀员工", issuer: "公司", date: "2021" },
    ]);
    const pairs = buildCandidatePairsForKind("honor", items, []);
    expect(pairs).toHaveLength(1);
  });

  it("honor merge：保留更长描述", () => {
    const a = toNewItems("honor", [{ title: "优秀员工", issuer: "公司", date: "2021", description: "短" }])[0];
    const b = toNewItems("honor", [{ title: "优秀员工", issuer: "公司", date: "2021", description: "更长的描述" }])[0];
    const m = mergeItems("honor", a, b);
    expect(m.raw.description).toBe("更长的描述");
  });

  it("sectionCandidate 跨类型复用：education 候选判定", () => {
    const a = toNewItems("education", [{ school: "清华大学", degree: "本科", startDate: "2015-09", endDate: "2019-06" }])[0];
    const b = toNewItems("education", [{ school: "清华大学", degree: "学士", startDate: "2015-09", endDate: "2019-06" }])[0];
    expect(sectionCandidate("education", a, b)).toBe(true);
  });
});

describe("buildApplySections 多 section 同时归约", () => {
  it("work + education 各自独立产出行写操作", () => {
    const workItems = toNewItems("work", [W({ company: "腾讯科技" }), W({ company: "字节跳动" })]);
    const eduItems = toNewItems("education", [
      { school: "清华大学", degree: "本科", startDate: "2015-09", endDate: "2019-06" },
      { school: "清华大学", degree: "学士", startDate: "2015-09", endDate: "2019-06" },
    ]);
    const eduHit: DupHit = { id: "intra:0:1", index: 0, kind: "intra", section: "education", otherIndex: 1, same: true, confidence: "high" };
    const res = buildApplySections([
      { kind: "work", items: workItems, hits: [], choices: {}, include: [true, true] },
      { kind: "education", items: eduItems, hits: [eduHit], choices: { "intra:0:1": "merge" } },
    ]);
    expect(res.work.ops.filter((o) => o.type === "create")).toHaveLength(2);
    expect(res.education.ops.filter((o) => o.type === "create")).toHaveLength(1);
    expect(res.education.dropped).toContain(1);
  });
});
