// 归一化规则：查重与匹配的基础，前后端共用同一实现。

const COMPANY_SUFFIXES =
  /(股份有限公司|有限公司|株式会社|合同会社|有限会社|co\.?,?\s*ltd\.?|inc\.?|corp\.?|llc|k\.k\.|g\.k\.)\s*$/i;

export function normalizeCompany(name: string): string {
  return name.trim().replace(COMPANY_SUFFIXES, "").trim().toLowerCase().slice(0, 128);
}

// 技能别名表：随数据积累扩充（Sprint 3 可挪到 DB 配置）
const SKILL_ALIASES: Record<string, string> = {
  postgres: "postgresql",
  "postgre sql": "postgresql",
  js: "javascript",
  ts: "typescript",
  "node.js": "nodejs",
  node: "nodejs",
  "react.js": "react",
  "vue.js": "vue",
  gcp: "google cloud",
  k8s: "kubernetes",
};

export function normalizeSkill(name: string): string {
  const lower = name.trim().toLowerCase().slice(0, 80);
  return SKILL_ALIASES[lower] ?? lower;
}
