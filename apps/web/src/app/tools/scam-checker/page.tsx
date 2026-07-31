import type { Metadata } from "next";
import { ScamCheckerClient } from "./scam-checker-client";

export const metadata: Metadata = {
  title: "幽灵岗 / 诈骗招聘检测 · CareerOS",
  description:
    "粘贴招聘文案，AI 识别入职押金、培训贷、刷单垫付等红旗并给出风险等级。免费、无需登录。",
};

export default function ScamCheckerPage() {
  return <ScamCheckerClient />;
}
