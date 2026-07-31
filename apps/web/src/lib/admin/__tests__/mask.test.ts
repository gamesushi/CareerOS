import { describe, it, expect } from "vitest";
import { maskEmail, maskSecret } from "../mask";

// 集成测试：管理后台 PII 脱敏——邮箱/密钥展示前必须脱敏，绝不出明文。

describe("maskEmail", () => {
  it("保留前 2 位 + 域名，中间打码", () => {
    expect(maskEmail("hebeihang@gmail.com")).toBe("he*******@gmail.com");
  });
  it("短本地名也至少一个星号", () => {
    expect(maskEmail("ab@x.com")).toBe("ab*@x.com");
    expect(maskEmail("a@x.com")).toBe("a*@x.com");
  });
  it("非法邮箱（无 @）返回 ***，不泄露", () => {
    expect(maskEmail("notanemail")).toBe("***");
  });
  it("域名始终可见（脱敏不影响可辨识域）", () => {
    expect(maskEmail("someone@careeros.dev").endsWith("@careeros.dev")).toBe(true);
  });
});

describe("maskSecret", () => {
  it("有值只显示「已配置」，绝不回显内容", () => {
    expect(maskSecret("sk-secret-123")).toBe("已配置 ••••");
    expect(maskSecret("sk-secret-123")).not.toContain("secret");
  });
  it("空值显示 —", () => {
    expect(maskSecret(null)).toBe("—");
    expect(maskSecret(undefined)).toBe("—");
    expect(maskSecret("")).toBe("—");
  });
});
