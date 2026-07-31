import { describe, it, expect } from "vitest";
import { usd, int, pct } from "../format";

// 集成测试：管理后台数值格式化（成本看板/概览用）。

describe("usd", () => {
  it("小额（<1）保留 4 位小数，便于看清微成本", () => {
    expect(usd(0.0123)).toBe("$0.0123");
    expect(usd(0)).toBe("$0.0000");
  });
  it("大额（≥1）保留 2 位小数", () => {
    expect(usd(12.5)).toBe("$12.50");
    expect(usd(1234.567)).toBe("$1234.57");
  });
});

describe("int", () => {
  it("千分位分隔", () => {
    expect(int(1234567)).toBe("1,234,567");
    expect(int(0)).toBe("0");
  });
});

describe("pct", () => {
  it("转百分比，1 位小数", () => {
    expect(pct(0.071)).toBe("7.1%");
    expect(pct(1)).toBe("100.0%");
    expect(pct(0)).toBe("0.0%");
  });
});
