import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 幂等哨兵：已存在演示组织则跳过
  const existing = await prisma.organization.findUnique({ where: { slug: "gamesushi" } });
  if (existing) {
    console.log("演示数据已存在（slug=gamesushi），跳过。");
    return;
  }

  // ---- 演示登录用户（截图用）----
  const user = await prisma.user.upsert({
    where: { email: "demo@careeros.local" },
    update: {},
    create: {
      email: "demo@careeros.local",
      name: "佐藤 健（デモ）",
      locale: "ja",
      jobStatus: "open",
      region: "東京",
      careerProfile: {
        create: {
          headline: "ゲームパブリッシング / グロース責任者",
          summary:
            "日本市場での手游パブリッシングとローカライゼーション運用を中心に、企画からリリース後のグロースまでを幅広く担当。AI を活用した採用・キャリア支援にも関心。",
          careerTags: ["ゲーム", "パブリッシング", "ローカライズ", "グロース"],
          careerLevel: "Lead",
          yearsExperience: 8,
          industryTags: ["ゲーム", "AI", "メディア"],
        },
      },
    },
  });
  const uid = user.id;

  // ---- 職務経験 ----
  const exp1 = await prisma.careerExperience.create({
    data: {
      userId: uid,
      company: "株式会社ゲーム寿司",
      companyNorm: "株式会社ゲーム寿司",
      title: "パブリッシング リード",
      employmentType: "正社員",
      startDate: new Date("2023-04-01"),
      location: "東京",
      description: "自社タイトルの日本市場展開とパートナー版権交渉をリード。",
      highlights: ["3 タイトルの日本ローンチを主導", "ローカライズ制作フローを構築"],
      lang: "ja",
    },
  });
  const exp2 = await prisma.careerExperience.create({
    data: {
      userId: uid,
      company: "ミクシィ（類似）",
      companyNorm: "ミクシィ",
      title: "プロダクトマネージャー",
      employmentType: "正社員",
      startDate: new Date("2019-07-01"),
      endDate: new Date("2023-03-31"),
      location: "東京",
      description: "ソーシャルゲームの企画・運用。",
      highlights: ["月間課金 2 倍を達成", "新規 IP の立ち上げ"],
      lang: "ja",
    },
  });
  const exp3 = await prisma.careerExperience.create({
    data: {
      userId: uid,
      company: "バンダイナムコ（類似）",
      companyNorm: "バンダイナムコ",
      title: "ローカライゼーション スペシャリスト",
      employmentType: "正社員",
      startDate: new Date("2016-04-01"),
      endDate: new Date("2019-06-30"),
      location: "東京",
      description: "海外タイトルの日本向けローカライズと品質確認。",
      highlights: ["10+ タイトルのローカライズ監修"],
      lang: "ja",
    },
  });

  // ---- プロジェクト ----
  const proj1 = await prisma.project.create({
    data: {
      userId: uid,
      experienceId: exp1.id,
      name: "桜戦記（自社タイトル）",
      role: "パブリッシング責任者",
      startDate: new Date("2023-06-01"),
      description: "和風ファンタジー RPG の日本展開。",
      outcome: "リリース 3 ヶ月で 50 万 DL。",
      techStack: ["Unity", "GameAnalytics"],
      lang: "ja",
    },
  });
  const proj2 = await prisma.project.create({
    data: {
      userId: uid,
      experienceId: exp2.id,
      name: "モンスターコロシアム",
      role: "PM",
      startDate: new Date("2020-01-01"),
      endDate: new Date("2022-12-31"),
      description: "バトル RPG の運用。",
      outcome: "ARPPU 改善により売上 2 倍。",
      techStack: ["Unity"],
      lang: "ja",
    },
  });

  // ---- 実績 ----
  await prisma.achievement.create({
    data: {
      userId: uid,
      experienceId: exp1.id,
      projectId: proj1.id,
      title: "日本ローンチ 50 万 DL",
      metricValue: 500000,
      metricUnit: "DL",
      metricText: "リリース 90 日",
      occurredAt: new Date("2023-09-01"),
    },
  });
  await prisma.achievement.create({
    data: {
      userId: uid,
      experienceId: exp2.id,
      projectId: proj2.id,
      title: "売上 2 倍",
      metricValue: 2,
      metricUnit: "x",
      metricText: "年次",
      occurredAt: new Date("2021-12-31"),
    },
  });

  // ---- スキル + 証拠 ----
  const skillDefs = [
    { name: "ゲームパブリッシング", cat: "domain", level: 88 },
    { name: "ローカライゼーション", cat: "domain", level: 82 },
    { name: "プロダクトマネジメント", cat: "domain", level: 80 },
    { name: "グロース施策", cat: "domain", level: 76 },
    { name: "データ分析", cat: "analytical", level: 70 },
    { name: "チームマネジメント", cat: "soft", level: 74 },
  ];
  const skillIds: Record<string, string> = {};
  for (const s of skillDefs) {
    const sk = await prisma.skill.create({
      data: {
        userId: uid,
        name: s.name,
        nameNorm: s.name,
        category: s.cat,
        level: s.level,
        levelSource: "manual",
        firstUsedAt: new Date("2016-04-01"),
        lastUsedAt: new Date("2024-01-01"),
      },
    });
    skillIds[s.name] = sk.id;
  }
  await prisma.skillEvidence.create({
    data: { skillId: skillIds["ゲームパブリッシング"], sourceType: "experience", sourceId: exp1.id, note: "自社タイトルの市場展開", weight: 3 },
  });
  await prisma.skillEvidence.create({
    data: { skillId: skillIds["ローカライゼーション"], sourceType: "experience", sourceId: exp3.id, note: "海外タイトル本地化監修", weight: 3 },
  });
  await prisma.skillEvidence.create({
    data: { skillId: skillIds["プロダクトマネジメント"], sourceType: "project", sourceId: proj2.id, note: "モンスターコロシアム PM", weight: 2 },
  });

  // ---- 学歴 ----
  await prisma.education.create({
    data: {
      userId: uid,
      school: "東京大学（類似）",
      faculty: "工学部",
      degree: "学士",
      major: "電気電子工学科",
      startDate: new Date("2012-04-01"),
      endDate: new Date("2016-03-31"),
    },
  });

  // ---- 求人ウォッチ + 発見求人（モニタリングフィード）----
  const watch = await prisma.jobWatch.create({
    data: {
      userId: uid,
      name: "ゲーム プロデューサー・東京",
      keywords: ["ゲーム プロデューサー", "ゲーム ディレクター"],
      sources: ["tencent", "bytedance", "kuro"],
      locations: ["東京"],
      matchRoles: ["producer", "director"],
      matchRegions: ["東京"],
      matchLanguages: ["ja"],
      matchExperience: ["senior", "lead"],
      excludeKeywords: ["インターン", "派遣"],
    },
  });
  const discovered = [
    { title: "シニアゲームプロデューサー", company: "株式会社サイバーエージェント", salary: "年収 900〜1200 万円", ext: "ca-1001", score: 92, reasons: ["パブリッシング経験", "東京"] },
    { title: "ゲームディレクター（RPG）", company: "株式会社ミクシィ", salary: "年収 800〜1100 万円", ext: "mx-2002", score: 88, reasons: ["PM 経験", "RPG 知見"] },
    { title: "ローカライゼーションプロデューサー", company: "株式会社バンダイナムコ", salary: "年収 700〜1000 万円", ext: "bn-3003", score: 84, reasons: ["本地化監修", "東京"] },
    { title: "ライブ運用プロデューサー", company: "株式会社アカツキ", salary: "年収 850〜1150 万円", ext: "ak-4004", score: 79, reasons: ["グロース施策"] },
    { title: "新規事業プロデューサー（ゲーム）", company: "株式会社捧げる", salary: "年収 750〜1050 万円", ext: "ho-5005", score: 76, reasons: ["新規 IP 立ち上げ"] },
  ];
  for (const d of discovered) {
    await prisma.discoveredJob.create({
      data: {
        watchId: watch.id,
        userId: uid,
        source: "tencent",
        externalId: d.ext,
        title: d.title,
        company: d.company,
        location: "東京",
        salary: d.salary,
        url: `https://example.com/jobs/${d.ext}`,
        snippet: `${d.company} での ${d.title} ポジション。日本市場のタイトル展開をリードしていただきます。`,
        publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        categories: ["game"],
        roles: ["producer", "director"],
        regions: ["東京"],
        languages: ["ja"],
        experience: ["senior", "lead"],
        status: "new",
        reviewStatus: "approved",
        matchScore: d.score,
        matchReasons: d.reasons.map((r, i) => ({ type: "skill", label: r, similarity: 0.9 - i * 0.05 })),
      },
    });
  }

  // ---- JD + マッチ + 履歴書 ----
  const jd = await prisma.jobDescription.create({
    data: {
      userId: uid,
      company: "株式会社サイバーエージェント",
      title: "シニアゲームプロデューサー",
      sourceUrl: "https://example.com/jobs/ca-1001",
      rawContent:
        "必須: ゲームパブリッシング経験 5 年以上、ローカライゼーション知見、チームマネジメント。歓迎: データ分析、グロース施策。場所: 東京。",
      lang: "ja",
      status: "parsed",
      parsed: { requiredSkills: ["ゲームパブリッシング", "ローカライゼーション", "チームマネジメント"] },
    },
  });
  await prisma.jobMatch.create({
    data: {
      jdId: jd.id,
      userId: uid,
      matchScore: 92,
      skillCoverage: 0.9,
      experienceCoverage: 0.95,
      industryCoverage: 1.0,
      missingSkills: ["VR 知見"],
      matchedEvidence: [{ skill: "ゲームパブリッシング", source: "自社タイトル市場展開" }],
    },
  });
  await prisma.resume.create({
    data: {
      userId: uid,
      title: "ゲームパブリッシング・履歴書（日本語）",
      resumeType: "ja_rirekisho",
      templateId: "openresume-classic",
      status: "final",
      resumeJson: {
        basics: { name: "佐藤 健", headline: "ゲームパブリッシング / グロース責任者", location: "東京" },
        work: [
          { name: "株式会社ゲーム寿司", position: "パブリッシング リード", summary: "自社タイトルの日本市場展開とパートナー版権交渉をリード。", highlights: ["3 タイトルの日本ローンチを主導", "ローカライズ制作フローを構築"], startDate: "2023-04", endDate: null },
          { name: "ミクシィ（類似）", position: "プロダクトマネージャー", summary: "ソーシャルゲームの企画・運用。", highlights: ["月間課金 2 倍を達成", "新規 IP の立ち上げ"], startDate: "2019-07", endDate: "2023-03" },
          { name: "バンダイナムコ（類似）", position: "ローカライゼーション スペシャリスト", summary: "海外タイトルの日本向けローカライズと品質確認。", highlights: ["10+ タイトルのローカライズ監修"], startDate: "2016-04", endDate: "2019-06" },
        ],
        sections: [{ title: "職務経験", items: [{ company: "株式会社ゲーム寿司", title: "パブリッシング リード" }] }],
      },
      jdId: jd.id,
    },
  });
  await prisma.resume.create({
    data: {
      userId: uid,
      title: "uCareerOS  Pitch Resume (EN)",
      resumeType: "en",
      templateId: "openresume-modern",
      status: "final",
      resumeJson: {
        basics: { name: "Ken Sato", headline: "Game Publishing / Growth Lead", location: "Tokyo" },
        work: [
          { name: "GameSushi", position: "Publishing Lead", summary: "Led Japan market expansion for self-published titles.", highlights: ["Led Japan launch of 3 titles", "Built localization production flow"], startDate: "2023-04", endDate: null },
        ],
        sections: [{ title: "Experience", items: [{ company: "GameSushi", title: "Publishing Lead" }] }],
      },
    },
  });

  // ---- 組織 + メンバー + 求人投稿（B 端）----
  const org = await prisma.organization.create({
    data: {
      slug: "gamesushi",
      name: "GameSushi 株式会社",
      orgType: "startup",
      description:
        "日本のゲームクリエイターと海外スタジオをつなぐパブリッシングカンパニー。AI を活用したキャリア・採用支援にも取り組む。",
      industry: "ゲーム",
      size: "11-50",
      location: "東京",
      website: "https://gamesushi.example.com",
      verified: true,
    },
  });
  await prisma.organizationMember.create({
    data: { orgId: org.id, userId: uid, role: "owner" },
  });
  const postingDefs = [
    { title: "ゲームプロデューサー（RPG）", role: "hr" as const, stage: "startup_0_3" as const, salary: "年収 800〜1100 万円", cat: "game", desc: "和風ファンタジー RPG のプロデューサーを募集。企画から運用までをリードしていただきます。" },
    { title: "ローカライゼーションマネージャー", role: "employee_referral" as const, stage: "startup_0_3" as const, salary: "年収 700〜1000 万円", cat: "game", desc: "海外タイトルの日本向けローカライズを統括するマネージャーを募集（内推枠）。" },
    { title: "グロースアナリスト（ゲーム）", role: "hiring_manager" as const, stage: "startup_0_3" as const, salary: "年収 650〜900 万円", cat: "ai", desc: "データ分析を通じたゲームのグロース施策を担っていただきます。" },
  ];
  const postings = [];
  for (const p of postingDefs) {
    postings.push(
      await prisma.jobPosting.create({
        data: {
          postedByUserId: uid,
          orgId: org.id,
          orgType: "startup",
          posterRole: p.role,
          companyStage: p.stage,
          company: "GameSushi 株式会社",
          title: p.title,
          location: "東京",
          salary: p.salary,
          description: p.desc,
          categories: [p.cat],
          status: "open",
          reviewStatus: "approved",
        },
      }),
    );
  }

  // ---- 応募（別ユーザーが自社投稿へ） ----
  const candidate = await prisma.user.upsert({
    where: { email: "candidate@careeros.local" },
    update: {},
    create: { email: "candidate@careeros.local", name: "鈴木 美咲", locale: "ja", jobStatus: "open" },
  });
  const candResume = await prisma.resume.create({
    data: {
      userId: candidate.id,
      title: "鈴木 美咲・履歴書",
      resumeType: "ja_rirekisho",
      status: "final",
      resumeJson: { basics: { name: "鈴木 美咲", headline: "ローカライズエンジニア" } },
    },
  });
  await prisma.jobApplication.create({
    data: {
      jobPostingId: postings[0].id,
      candidateId: candidate.id,
      resumeId: candResume.id,
      coverLetter: "GameSushi のビジョンに強く共感し、応募いたしました。",
      status: "screening",
    },
  });

  // ---- 応募トラッカー（候補者側かんばん）----
  await prisma.application.create({
    data: { userId: uid, title: "シニアゲームプロデューサー", company: "サイバーエージェント", location: "東京", salary: "年収 900〜1200 万円", source: "tencent", stage: "applied", matchScore: 92, nextAction: "面接日程調整", nextActionAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5) },
  });
  await prisma.application.create({
    data: { userId: uid, title: "ゲームディレクター（RPG）", company: "ミクシィ", location: "東京", salary: "年収 800〜1100 万円", source: "bytedance", stage: "interview", matchScore: 88, nextAction: "最終面接", nextActionAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2) },
  });
  await prisma.application.create({
    data: { userId: uid, title: "ライブ運用プロデューサー", company: "アカツキ", location: "東京", salary: "年収 850〜1150 万円", source: "kuro", stage: "considering", matchScore: 79, nextAction: "企業研究", nextActionAt: null },
  });

  console.log(`デモデータ作成完了: user=${uid}, org=${org.id}, postings=${postings.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
