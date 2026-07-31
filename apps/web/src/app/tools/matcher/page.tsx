import type { Metadata } from "next";
import { MatcherClient } from "./matcher-client";

export const metadata: Metadata = {
  title: "简历 ↔ JD 关键词匹配器 · CareerOS",
  description:
    "粘贴简历与岗位 JD，实时计算关键词重合度，高亮命中与缺失关键词。纯前端、零上传、保护隐私。",
};

export default function MatcherPage() {
  return <MatcherClient />;
}
