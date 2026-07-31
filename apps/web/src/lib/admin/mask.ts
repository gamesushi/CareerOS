// PII 脱敏：管理后台展示用户数据时，敏感字段一律脱敏，不出明文。
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  const head = name.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
}

// 密钥/令牌类：只显示是否已配置，绝不回显内容。
export function maskSecret(v: string | null | undefined): string {
  return v ? "已配置 ••••" : "—";
}
