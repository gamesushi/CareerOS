// 落地页共享类型。t 为服务端翻译函数（由 page.tsx 注入，避免每个区块各自 await）。

export type TFn = (key: string, params?: Record<string, string | number>) => string;

/** 从 listPublicPostings() 映射出的、落地页渲染所需的最小字段。 */
export interface LandingPosting {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  salary: string | null;
  referralCode: string | null;
  categories: string[];
  orgSlug: string | null;
  orgName: string | null;
  orgVerified: boolean;
  posterRole: string | null;
}
