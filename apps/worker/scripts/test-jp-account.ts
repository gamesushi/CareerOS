/**
 * 日本アカウント生成 + 各 AI 機能の日本語動作テスト（無頭テスト）。
 * 実行: cd apps/worker && npx tsx --env-file=../.env scripts/test-jp-account.ts
 *
 * ・日本語のユーザー/職務データを DB に投入（アカウント生成）
 * ・resumeParse / jdParse / profileGenerate / resumeGenerate(ja_shokumu) を呼び出し
 * ・各出力が日本語であり、構造が valid かを検証して PASS/FAIL を印字
 */
import { prisma, Prisma } from "@careeros/db";
import { handleResumeGenerateJob } from "../src/jobs/resumeGenerate";
import { handleProfileGenerateJob } from "../src/jobs/profileGenerate";
import { runResumeParse } from "../src/ai/tasks/resumeParse";
import { runJdParse } from "../src/ai/tasks/jdParse";

const JP_EMAIL = "jp.yamada@careeros.test";
const CURRENT_TOS = "2026-08-01";
const d = (s: string) => new Date(`${s}-01`);

// ---- 日本語テスト用データ（AI が生成）----
const JP_RESUME_MD = `山田 太郎
東京都港区
090-1234-5678 | yamada.taro@example.jp | https://github.com/yamada-taro

【職務要約】
大規模Webサービスのインフラ設計・SREを8年経験。コンテナオーケストレーションと観測性向上により、デプロイ頻度を3倍、障害復旧時間を60%短縮した。

【職歴】
株式会社クラウドテック | シニアSRE | 2021-04〜現在 | 東京
・大規模ECプラットフォームのSREとして基盤を設計・運用
・Kubernetes移行によりデプロイ頻度を月2回から週3回へ向上
・障害復旧時間(MTTR)を60%短縮、可用性99.95%を達成

株式会社データウェーブ | インフラエンジニア | 2018-07〜2021-03 | 大阪
・データパイプラインの基盤をTerraformでコード化
・監視設計を見直し、アラートノイズを40%削減

株式会社ウェブソリューション | ジュニアエンジニア | 2016-04〜2018-06 | 名古屋
・社内ツールの開発・運用を担当

【学歴】
東京工業大学 | 工学部 情報工学科 | 学士 | 2012-04〜2016-03

【スキル】
Kubernetes、Terraform、Go、Prometheus、AWS、インシデント対応、監視設計

【資格】
AWS認定ソリューションアーキテクト（2020年取得）
`;

const JP_JD = `株式会社クラウドテック 募集要項

職種：シニアSRE（サイト信頼性エンジニア）
雇用形態：正社員
勤務地：東京都港区（リモート併用可）
年収：800万円〜1200万円

仕事内容：
大規模ECプラットフォームの信頼性向上を担うSREを募集します。Kubernetesを用いたコンテナオーケストレーション、監視・可観測性の設計、インシデント対応をリードしていただきます。

必須スキル：
・Kubernetes の運用実務 3年以上
・Terraform 等による IaC 経験
・Go または Python でのツール開発
・AWS などのクラウド基盤の知識

歓迎スキル：
・Prometheus / Grafana を用いた監視設計
・大規模分散システムのトラブルシューティング

語学：日本語ネイティブ、英語ビジネスレベル尚可
`;

function cjkCount(s: unknown): number {
  return String(s ?? "").replace(/[^\u3000-\u9fff\uff00-\uffef]/g, "").length;
}

function check(label: string, ok: boolean, sample?: string) {
  const mark = ok ? "✅ PASS" : "❌ FAIL";
  console.log(`\n[${mark}] ${label}`);
  if (sample) console.log("   " + sample.split("\n").slice(0, 6).join("\n   "));
  return ok;
}

async function seedJapaneseAccount() {
  // 既存があれば cascade 削除して作り直し
  const exist = await prisma.user.findUnique({ where: { email: JP_EMAIL } });
  if (exist) await prisma.user.delete({ where: { id: exist.id } });

  const user = await prisma.user.create({
    data: {
      email: JP_EMAIL,
      name: "山田 太郎",
      locale: "ja",
      region: "日本",
      mobile: "090-1234-5678",
      preferredCity: "東京",
      workAuthStatus: "other",
      snsLinks: [
        { network: "X", url: "https://x.com/yamada_taro" },
        { network: "GitHub", url: "https://github.com/yamada-taro" },
        { network: "Qiita", url: "https://qiita.com/yamada" },
      ] as unknown as Prisma.InputJsonValue,
      languages: [
        { name: "日本語", proficiency: "母語" },
        { name: "英語", proficiency: "ビジネスレベル" },
        { name: "中国語", proficiency: "日常会話" },
      ] as unknown as Prisma.InputJsonValue,
      tosAcceptedAt: new Date(),
      tosVersion: CURRENT_TOS,
    },
  });
  const uid = user.id;

  await prisma.careerProfile.create({
    data: {
      userId: uid,
      headline: "シニアSRE｜クラウド基盤・可観測性",
      summary:
        "東京を拠点に大規模Webサービスのインフラ設計・SREを8年経験。Kubernetes移行と監視設計によりデプロイ頻度を3倍、障害復旧時間を60%短縮。",
    },
  });

  await prisma.careerExperience.createMany({
    data: [
      {
        userId: uid, company: "株式会社クラウドテック", title: "シニアSRE",
        startDate: d("2021-04"), endDate: null, location: "東京", employmentType: "full_time",
        description: "大規模ECプラットフォームのSREとして基盤を設計・運用。Kubernetes移行によりデプロイ頻度を月2回から週3回へ向上。",
        highlights: ["Kubernetes移行でデプロイ頻度を3倍に向上", "MTTRを60%短縮、可用性99.95%を達成"],
        companyNorm: "株式会社クラウドテック".toLowerCase(),
      },
      {
        userId: uid, company: "株式会社データウェーブ", title: "インフラエンジニア",
        startDate: d("2018-07"), endDate: d("2021-03"), location: "大阪", employmentType: "full_time",
        description: "データパイプライン基盤をTerraformでコード化。監視設計の見直しでアラートノイズを40%削減。",
        highlights: ["Terraformで基盤をコード化", "アラートノイズ40%削減"],
        companyNorm: "株式会社データウェーブ".toLowerCase(),
      },
      {
        userId: uid, company: "株式会社ウェブソリューション", title: "ジュニアエンジニア",
        startDate: d("2016-04"), endDate: d("2018-06"), location: "名古屋", employmentType: "full_time",
        description: "社内ツールの開発・運用を担当。",
        highlights: ["社内ツールの開発・運用"],
        companyNorm: "株式会社ウェブソリューション".toLowerCase(),
      },
    ],
  });

  await prisma.project.createMany({
    data: [
      {
        userId: uid, name: "Kubernetes移行プロジェクト", role: "リード",
        startDate: d("2021-09"), endDate: d("2022-06"),
        description: "モノリシックなデプロイをコンテナ化し、週3回の継続的デリバリーを実現。",
        outcome: "デプロイ頻度を3倍に向上", techStack: ["Kubernetes", "ArgoCD", "Go"],
      },
      {
        userId: uid, name: "統合監視基盤の構築", role: "設計",
        startDate: d("2019-01"), endDate: d("2019-12"),
        description: "Prometheus/Grafanaを用いた監視基盤を刷新。",
        outcome: "アラートノイズを40%削減", techStack: ["Prometheus", "Grafana"],
      },
    ],
  });

  const skills: Omit<Prisma.SkillCreateManyInput, "nameNorm">[] = [
    { userId: uid, name: "Kubernetes", level: 90, category: "tool", levelSource: "manual" },
    { userId: uid, name: "Terraform", level: 85, category: "tool", levelSource: "manual" },
    { userId: uid, name: "Go", level: 80, category: "framework", levelSource: "manual" },
    { userId: uid, name: "監視設計", level: 82, category: "domain", levelSource: "manual" },
    { userId: uid, name: "インシデント対応", level: 88, category: "soft", levelSource: "manual" },
  ];
  await prisma.skill.createMany({ data: skills.map((s) => ({ ...s, nameNorm: s.name.toLowerCase() })) });

  await prisma.achievement.createMany({
    data: [
      { userId: uid, title: "デプロイ頻度を3倍に向上", metricValue: 3, metricUnit: "倍", occurredAt: d("2022-06") },
      { userId: uid, title: "MTTRを60%短縮", metricValue: 60, metricUnit: "%", occurredAt: d("2022-06") },
    ],
  });

  await prisma.education.createMany({
    data: [
      { userId: uid, school: "東京工業大学", faculty: "工学部", degree: "学士", major: "情報工学科", startDate: d("2012-04"), endDate: d("2016-03") },
    ],
  });

  console.log("✅ 日本アカウント投入完了:", JP_EMAIL, uid);
  return uid;
}

async function main() {
  const uid = await seedJapaneseAccount();
  let allPass = true;

  // 1) 简历解析（resumeParse）
  try {
    const { result } = await runResumeParse(JP_RESUME_MD);
    const ok = cjkCount(result.basics?.name) > 0 && (result.experiences?.length ?? 0) > 0;
    allPass = check("1) resumeParse（日本語履歴書→構造化）", ok,
      `name=${result.basics?.name} / exp=${result.experiences?.length}件 / edu=${result.educations?.length}件`) && allPass;
  } catch (e) {
    allPass = check("1) resumeParse", false, String(e)) && allPass;
  }

  // 2) JD 解析（jdParse）
  try {
    const { result } = await runJdParse(JP_JD);
    const ok = cjkCount(result.company) > 0 && (result.skills?.length ?? 0) > 0;
    allPass = check("2) jdParse（日本語JD→構造化）", ok,
      `company=${result.company} / title=${result.title} / skills=${result.skills?.length}件`) && allPass;
  } catch (e) {
    allPass = check("2) jdParse", false, String(e)) && allPass;
  }

  // 3) 職業画像生成（profileGenerate）
  try {
    await handleProfileGenerateJob(uid);
    const cp = await prisma.careerProfile.findUnique({ where: { userId: uid } });
    const ok = !!cp && cjkCount(cp.headline) > 0 && cjkCount(cp.summary) > 0;
    allPass = check("3) profileGenerate（職業画像）", ok,
      `headline=${cp?.headline}\nsummary=${cp?.summary?.slice(0, 60)}…`) && allPass;
  } catch (e) {
    allPass = check("3) profileGenerate", false, String(e)) && allPass;
  }

  // 4) 日本語履歴書生成（resumeGenerate / ja_shokumu）
  try {
    const resume = await prisma.resume.create({
      data: {
        userId: uid, title: "職務経歴書（テスト）", resumeType: "ja_shokumu",
        resumeJson: {} as unknown as Prisma.InputJsonValue, status: "draft",
      },
    });
    await handleResumeGenerateJob(resume.id);
    const updated = await prisma.resume.findUnique({ where: { id: resume.id } });
    const json = updated?.resumeJson as any;
    const ok = !!json && cjkCount(json?.basics?.name) > 0 && cjkCount(json?.["x-jis"]?.jikoPR) > 0;
    allPass = check("4) resumeGenerate（日本語職務経歴書）", ok,
      `name=${json?.basics?.name} / work=${json?.work?.length}件 / 自己PR=${json?.["x-jis"]?.jikoPR?.slice(0, 40)}…`) && allPass;
  } catch (e) {
    allPass = check("4) resumeGenerate", false, String(e)) && allPass;
  }

  console.log("\n========================================");
  console.log(allPass ? "🎉 全機能 PASS（日本語正常動作）" : "⚠️ 一部 FAIL — 上記を確認");
  console.log("========================================");
}

main()
  .catch((e) => { console.error("FATAL", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
