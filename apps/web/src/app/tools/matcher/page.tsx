import type { Metadata } from "next";
import { MatcherClient } from "./matcher-client";

export const metadata: Metadata = {
  title: "履歴書 ↔ JD キーワードマッチャー · CareerOS",
  description:
    "履歴書と求人 JD を貼り付け、キーワードの一致度をリアルタイム計算。フロントエンド完結、アップロードなし。",
};

export default function MatcherPage() {
  return <MatcherClient />;
}
