import type { TemplateProps } from "./common";
import { TEMPLATE_META, resolveTemplateMeta, type TemplateMeta } from "./template-meta";
import { ClassicTemplate } from "./templates/classic";
import { ModernTemplate } from "./templates/modern";
import { SidebarTemplate } from "./templates/sidebar";
import { CompactTemplate } from "./templates/compact";
import { AtsTemplate } from "./templates/ats";
import { ShokumuTemplate } from "./templates/shokumu";
import { RirekishoTemplate } from "./templates/rirekisho";

// 模板注册表（docs/design/00 ADR-004：渲染器可插拔）。仅服务端使用（react-pdf）。
// modern/sidebar/compact 布局参考 Reactive Resume（MIT）的 Onyx/Azurill/Kakuna 设计思路，
// 代码为基于 JSON Resume 数据模型的原创 react-pdf 实现。

export type TemplateDef = TemplateMeta & {
  component: (props: TemplateProps) => React.ReactElement;
};

const COMPONENTS: Record<string, TemplateDef["component"]> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  sidebar: SidebarTemplate,
  compact: CompactTemplate,
  ats: AtsTemplate,
  shokumu: ShokumuTemplate,
  rirekisho: RirekishoTemplate,
};

export const TEMPLATES: TemplateDef[] = TEMPLATE_META.map((meta) => ({
  ...meta,
  component: COMPONENTS[meta.id] ?? ClassicTemplate,
}));

export function resolveTemplate(templateId: string | null | undefined): TemplateDef {
  const meta = resolveTemplateMeta(templateId);
  return TEMPLATES.find((t) => t.id === meta.id) ?? TEMPLATES[0];
}
