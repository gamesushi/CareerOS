// 管理后台数值格式化（内部页面，固定 en-US 千分位）。
export const usd = (n: number): string => `$${n < 1 ? n.toFixed(4) : n.toFixed(2)}`;
export const int = (n: number): string => n.toLocaleString("en-US");
export const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;
