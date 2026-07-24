import { prisma, Prisma } from "@careeros/db";
import { jsonResume } from "@careeros/shared";
import { renderToFile } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { AtsTemplate } from "@/lib/pdf/templates/ats";

const USER_EMAIL = "dev@careeros.local";
const d = (s: string) => new Date(`${s}-01`);

async function seed() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: USER_EMAIL } });
  const uid = user.id;

  await prisma.achievement.deleteMany({ where: { userId: uid } });
  await prisma.honor.deleteMany({ where: { userId: uid } });
  await prisma.project.deleteMany({ where: { userId: uid } });
  await prisma.skillEvidence.deleteMany({ where: { skill: { userId: uid } } });
  await prisma.skill.deleteMany({ where: { userId: uid } });
  await prisma.education.deleteMany({ where: { userId: uid } });
  await prisma.careerExperience.deleteMany({ where: { userId: uid } });
  await prisma.careerProfile.deleteMany({ where: { userId: uid } });

  await prisma.user.update({
    where: { id: uid },
    data: {
      name: "何北航",
      mobile: "13800000000",
      preferredCity: "San Jose",
      workAuthStatus: "requires_sponsorship",
      snsLinks: [
        { network: "LinkedIn", url: "https://www.linkedin.com/in/your-profile/" },
        { network: "知乎", url: "https://www.zhihu.com/people/your-handle" },
        { network: "Gamesushi", url: "gamesushi" },
      ] as unknown as never,
      languages: [
        { name: "中文", proficiency: "母语" },
        { name: "日语", proficiency: "商务流利" },
        { name: "英语", proficiency: "专业" },
      ] as unknown as never,
    },
  });

  await prisma.careerProfile.create({
    data: {
      userId: uid,
      headline: "资深平台架构师 · 企业 AI Agent｜海外市场 / 日本",
      summary:
        "深耕日本市场与创作者生态 10 年，横跨金融、游戏与内容产业。擅长以数据驱动的市场分析、KOL/MCN 运营与跨文化协作，并建立 AI 驱动的内容生产流程，将交付周期缩短 60%+。",
    },
  });

  const experiences = [
    {
      userId: uid, company: "GameSushi 株式会社", title: "创始人",
      startDate: d("2023-03"), endDate: null, location: "东京 / 远程",
      description:
        "在日本创立并运营跨平台自媒体矩阵，单篇内容最高 100,000+ 阅读，粉丝覆盖头部游戏公司、基金、证券及投资核心决策层。建立 AI 驱动的内容生产与运营流程（采集、选题、生成、质控），将内容交付周期缩短 60%+。为腾讯、朝夕光年等头部公司提供日本市场进入策略。",
      highlights: [
        "创立「游戏寿司」等账号，单篇最高 100,000+ 阅读",
        "搭建 AI 内容工作流，交付周期缩短 60%+",
        "为腾讯 / 朝夕光年提供日本市场进入策略",
      ],
      employmentType: "full_time",
    },
    {
      userId: uid, company: "深圳字节跳动信息科技有限公司", title: "资深测评分析师（海外市场）",
      startDate: d("2022-10"), endDate: d("2023-02"), location: "深圳",
      description:
        "月度 300+ 案例深度拆解，基于产品结构、用户反馈与市场数据提出表现预判，推荐项目上线后进入 iOS 畅销榜 Top15。构建日本市场内容 / IP 价值评估模型，输出用户偏好与趋势分析报告。",
      highlights: [
        "月度 300+ 案例拆解，推荐项目进入 iOS 畅销榜 Top15",
        "构建日本 IP 价值评估模型",
      ],
      employmentType: "full_time",
    },
    {
      userId: uid, company: "腾讯科技（深圳）有限公司", title: "增长运营",
      startDate: d("2021-12"), endDate: d("2022-10"), location: "深圳",
      description:
        "调研 UGC 社区与虚拟内容生态等新兴数字内容模式，评估对用户增长的影响；基于全球科技公司财报与市场数据开展日本市场相关业务分析。",
      highlights: ["研究 UGC / 虚拟内容生态对增长的影响", "日本市场业务数据分析"],
      employmentType: "full_time",
    },
    {
      userId: uid, company: "广州博冠信息科技有限公司（网易游戏）", title: "高级研究员（用户体验中心）",
      startDate: d("2019-09"), endDate: d("2021-11"), location: "广州",
      description:
        "撰写《日本 SNS 使用行为与数字内容市场研究》，主导 50+ 日本用户调研，使用 SPSS / Excel 清洗与可视化数据，建立日语问卷翻译与本地化流程。",
      highlights: [
        "撰写《日本 SNS 使用行为与数字内容市场研究》",
        "主导 50+ 日本用户调研，SPSS / Excel 数据分析",
        "建立日语问卷翻译与本地化流程",
      ],
      employmentType: "full_time",
    },
    {
      userId: uid, company: "中国民生银行股份有限公司（总行）", title: "项目经理",
      startDate: d("2015-06"), endDate: d("2019-09"), location: "北京",
      description:
        "负责直销银行官方内容与市场沟通渠道运营，首创 10 万+ 阅读记录；负责「基金通」等产品营销运营，参与设计「救急金」服务机制，统筹基金通运营团队。",
      highlights: [
        "运营期间首创 10 万+ 阅读记录",
        "设计「救急金」机制，成为业内「闪电贷」参考",
        "统筹基金通运营团队高效落地",
      ],
      employmentType: "full_time",
    },
  ];
  await prisma.careerExperience.createMany({
    data: experiences.map((e) => ({ ...e, companyNorm: e.company.toLowerCase() })),
  });

  await prisma.education.createMany({
    data: [
      { userId: uid, school: "浙江大学", faculty: "传媒与人文学院", degree: "学士", major: "广告学", startDate: d("2007-09"), endDate: d("2011-06") },
      { userId: uid, school: "北海道大学", faculty: "国际传媒与观光学院", degree: "硕士", major: "国际传媒", startDate: d("2012-10"), endDate: d("2015-03") },
    ],
  });

  await prisma.project.createMany({
    data: [
      {
        userId: uid, name: "AI 辅助微信公众号编辑器开发", role: "独立开发",
        startDate: d("2025-10"), endDate: d("2025-10"),
        description:
          "基于开源项目二次开发，设计面向非虚构写作的 AI 工具。新增 AI 标题生成、段落润色、摘要扩写等功能，构建「写作-排版-发布」一体化工作流，大幅降低运营成本。",
        techStack: ["AI", "内容工作流", "开源二次开发"],
      },
      {
        userId: uid, name: "《原神》日本跨平台内容营销与创作者生态研究", role: "研究",
        startDate: d("2020-10"), endDate: d("2020-10"),
        description:
          "系统拆解《原神》在日本市场的预约、发行及长线社媒矩阵运营策略，结合加布里埃尔·塔尔德「模仿理论」剖析同人创作病毒式传播机制。",
        techStack: ["整合营销", "UGC 传播", "KOL"],
      },
      {
        userId: uid, name: "日本头部社媒（Twitter / LINE）内容运营与爆款机制洞察", role: "研究",
        startDate: d("2020-01"), endDate: d("2020-01"),
        description:
          "系统抓取并分析头部产品上千条推文，提炼高转发内容底层逻辑，总结自动化机器人回复与视觉化排版等精细化互动运营方法。",
        techStack: ["数据分析", "社媒运营", "爆款机制"],
      },
      {
        userId: uid, name: "日本直播与内容创作者（KOL / MCN）生态深度调研", role: "研究",
        startDate: d("2020-09"), endDate: d("2020-09"),
        description:
          "深度拆解 17 Live、LINE LIVE 等内容平台核心竞争力，研究日本独有的 MCN 机构与创作者松散合作生态。",
        techStack: ["KOL", "MCN", "平台生态"],
      },
      {
        userId: uid, name: "泛社交与垂类 UGC 内容平台 Z 世代行为研究", role: "研究",
        startDate: d("2021-01"), endDate: d("2021-01"),
        description:
          "系统分析半次元、积目、same 等社区产品机制，剖析 Z 世代与千禧一代的性别比例、年龄分层与表达意愿差异，研究垂类标签与线下社群引导的活跃度驱动。",
        techStack: ["用户研究", "Z 世代", "UGC 社区"],
      },
    ],
  });

  const skills: Omit<Prisma.SkillCreateManyInput, "nameNorm">[] = [
      { userId: uid, name: "内容策略", level: 85, category: "strategy", levelSource: "manual" },
      { userId: uid, name: "日本市场进入策略", level: 80, category: "strategy", levelSource: "manual" },
      { userId: uid, name: "KOL / MCN 运营", level: 82, category: "growth", levelSource: "manual" },
      { userId: uid, name: "数据分析（SPSS / Excel）", level: 78, category: "data", levelSource: "manual" },
      { userId: uid, name: "用户调研", level: 80, category: "research", levelSource: "manual" },
      { userId: uid, name: "跨文化协作", level: 85, category: "soft", levelSource: "manual" },
      { userId: uid, name: "AI 内容工作流", level: 75, category: "ai", levelSource: "manual" },
      { userId: uid, name: "产品测评", level: 78, category: "research", levelSource: "manual" },
    ];
  await prisma.skill.createMany({
    data: skills.map((s) => ({ ...s, nameNorm: s.name.toLowerCase() })),
  });

  await prisma.achievement.createMany({
    data: [
      { userId: uid, title: "单篇内容最高阅读量 100,000+", occurredAt: d("2024-01") },
      { userId: uid, title: "AI 内容交付周期缩短 60%+", occurredAt: d("2024-01") },
      { userId: uid, title: "推荐项目进入 iOS 畅销榜 Top 15", occurredAt: d("2022-12") },
      { userId: uid, title: "运营期间首创 10 万+ 阅读记录", occurredAt: d("2018-01") },
    ],
  });

  console.log("seed done for", USER_EMAIL);
}

async function buildAndRender() {
  const user = await prisma.user.findUniqueOrThrow({ where: { email: USER_EMAIL }, include: { careerProfile: true } });
  const [experiences, projects, skills, achievements, educations, honors] = await Promise.all([
    prisma.careerExperience.findMany({ where: { userId: user.id }, orderBy: { startDate: "desc" } }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { startDate: "desc" } }),
    prisma.skill.findMany({ where: { userId: user.id }, orderBy: { level: "desc" } }),
    prisma.achievement.findMany({ where: { userId: user.id } }),
    prisma.education.findMany({ where: { userId: user.id }, orderBy: { startDate: "desc" } }),
    prisma.honor.findMany({ where: { userId: user.id } }),
  ]);

  const fmtM = (x: Date | null) => (x ? x.toISOString().slice(0, 7) : "");
  const sns = Array.isArray(user.snsLinks) ? (user.snsLinks as { network: string; url: string }[]) : [];
  const langs = Array.isArray(user.languages) ? (user.languages as { name: string; proficiency?: string }[]) : [];

  const resume = jsonResume.parse({
    basics: {
      name: user.name,
      label: user.careerProfile?.headline ?? undefined,
      email: user.email,
      phone: user.mobile ?? undefined,
      location: user.preferredCity ?? user.region ?? undefined,
      summary: user.careerProfile?.summary ?? undefined,
      url: sns.find((s) => /linkedin|personal|个人|blog|site/i.test(s.network))?.url ?? undefined,
      profiles: sns.map((s) => ({ network: s.network, url: s.url })),
    },
    work: experiences.map((e) => ({
      name: e.company,
      position: e.title + (e.employmentType === "internship" ? "（实习）" : ""),
      startDate: fmtM(e.startDate),
      endDate: e.endDate ? fmtM(e.endDate) : undefined,
      location: e.location ?? undefined,
      summary: e.description ?? undefined,
      highlights: e.highlights,
    })),
    projects: projects.map((p) => ({
      name: p.name,
      description: [p.description, p.outcome].filter(Boolean).join(" ") || undefined,
      keywords: p.techStack,
      roles: p.role ? [p.role] : [],
      startDate: fmtM(p.startDate),
      endDate: fmtM(p.endDate),
      highlights: [],
    })),
    skills: skills.map((s) => ({
      name: s.name,
      level: s.level >= 80 ? "精通" : s.level >= 60 ? "熟练" : "掌握",
      keywords: [],
    })),
    education: educations.map((e) => ({
      institution: e.school,
      studyType: [e.faculty, e.degree].filter(Boolean).join(" · ") || undefined,
      area: e.major ?? undefined,
      startDate: fmtM(e.startDate),
      endDate: fmtM(e.endDate),
      score: e.gpa ?? undefined,
    })),
    awards: [
      ...achievements.map((a) => ({ title: a.title, date: a.occurredAt ? a.occurredAt.toISOString().slice(0, 7) : undefined })),
      ...honors.map((h) => ({ title: h.title, issuer: h.issuer ?? undefined, date: h.date ? h.date.toISOString().slice(0, 7) : undefined })),
    ],
    "x-meta": { languages: langs.map((l) => (l.proficiency ? `${l.name}（${l.proficiency}）` : l.name)) },
  });

  const out = "/tmp/careeros_ats.pdf";
  await renderToFile(createElement(AtsTemplate, { resume, lang: "en", accent: "#111111" }) as unknown as ReactElement<any>, out);
  console.log("PDF written:", out);
}

(async () => {
  try {
    await seed();
    await buildAndRender();
  } catch (e) {
    console.error("ERROR", e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
