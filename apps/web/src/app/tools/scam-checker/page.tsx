import type { Metadata } from "next";
import { ScamCheckerClient } from "./scam-checker-client";

export const metadata: Metadata = {
  title: "スカム・詐欺求人検出 · uCareerOS",
  description:
    "求人文案を貼り付け、AI が入金保証金・研修ローン・転売ヤラセなどの赤旗を検出しリスクレベルを提示。",
};

export default function ScamCheckerPage() {
  return <ScamCheckerClient />;
}
