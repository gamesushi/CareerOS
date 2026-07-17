// 模板元数据：客户端安全（不引入 react-pdf），编辑器/生成对话框共用。
// 组件映射在 registry.ts（仅服务端）。

export type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  defaultAccent: string;
};

export const TEMPLATE_META: TemplateMeta[] = [
  { id: "classic", name: "经典", description: "单栏黑白，稳妥通用", defaultAccent: "#222222" },
  { id: "modern", name: "现代", description: "强调色横线与标题，外企风", defaultAccent: "#2563eb" },
  { id: "sidebar", name: "侧栏", description: "双栏+时间线，信息密度高", defaultAccent: "#0f766e" },
  { id: "compact", name: "紧凑", description: "居中极简，一页装下更多", defaultAccent: "#525252" },
];

export function resolveTemplateMeta(templateId: string | null | undefined): TemplateMeta {
  const id = templateId?.replace(/^openresume-/, "") ?? "classic";
  return TEMPLATE_META.find((t) => t.id === id) ?? TEMPLATE_META[0];
}
