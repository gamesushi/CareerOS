/**
 * English account generation + AI feature English-output test (headless).
 * Run: cd apps/worker && ./node_modules/.bin/tsx --env-file=/Users/hebeihang/DEV/tools/careeros/.env scripts/test-en-account.ts
 *
 *  - Seeds an English-speaking account (locale=en, region=US, requires_sponsorship)
 *  - Calls resumeParse / jdParse / profileGenerate / resumeGenerate(en)
 *  - Verifies outputs are valid English (Latin-heavy, no CJK leakage)
 */
import { prisma, Prisma } from "@careeros/db";
import { handleResumeGenerateJob } from "../src/jobs/resumeGenerate";
import { handleProfileGenerateJob } from "../src/jobs/profileGenerate";
import { runResumeParse } from "../src/ai/tasks/resumeParse";
import { runJdParse } from "../src/ai/tasks/jdParse";

const EN_EMAIL = "en.user@careeros.test";
const CURRENT_TOS = "2026-08-01";
const d = (s: string) => new Date(`${s}-01`);

// ---- English test data (AI generated) ----
const EN_RESUME_MD = `Alex Carter
San Francisco, CA | +1-415-555-0142 | alex.carter@example.com | https://github.com/alexcarter

SUMMARY
Senior Site Reliability Engineer with 8 years building and operating large-scale distributed systems. Drove a Kubernetes migration that tripled deployment frequency and cut MTTR by 60% for a high-traffic e-commerce platform.

EXPERIENCE
CloudTech Inc. | Senior SRE | Apr 2021 - Present | San Francisco, CA
- Designed and operated the SRE foundation for a large-scale e-commerce platform.
- Led a Kubernetes migration, increasing deployment frequency from twice a month to three times a week.
- Reduced incident recovery time (MTTR) by 60% and achieved 99.95% availability.

DataWave LLC | Infrastructure Engineer | Jul 2018 - Mar 2021 | Seattle, WA
- Codified the data-pipeline infrastructure with Terraform.
- Redesigned monitoring and cut alert noise by 40%.

WebSolutions Co. | Junior Engineer | Apr 2016 - Jun 2018 | Austin, TX
- Developed and operated internal tooling.

EDUCATION
University of Washington | B.S. in Computer Science | 2012 - 2016

SKILLS
Kubernetes, Terraform, Go, Prometheus, AWS, Incident Response, Observability

CERTIFICATIONS
AWS Certified Solutions Architect (2020)
`;

const EN_JD = `CloudTech Inc. - Senior SRE Job Description

Role: Senior Site Reliability Engineer
Type: Full-time
Location: San Francisco, CA (Hybrid)
Salary: $130,000 - $180,000 per year

About the Role:
We are hiring an SRE to lead reliability improvements for our large-scale e-commerce platform. You will lead container orchestration with Kubernetes, design observability and monitoring, and own incident response.

Required Skills:
- 3+ years operating Kubernetes in production
- Infrastructure as Code experience with Terraform
- Tooling development in Go or Python
- Strong knowledge of cloud infrastructure (AWS)

Preferred Skills:
- Monitoring design with Prometheus / Grafana
- Troubleshooting large distributed systems

Languages: English fluent; Japanese business level a plus
`;

function cjkCount(s: unknown): number {
  return String(s ?? "").replace(/[^\u3000-\u9fff\uff00-\uffef]/g, "").length;
}
function latinCount(s: unknown): number {
  return String(s ?? "").replace(/[^A-Za-z]/g, "").length;
}
// English output: dominated by Latin, must NOT contain CJK leakage
function isEnglish(s: unknown, threshold = 0.08): boolean {
  const s2 = String(s ?? "");
  if (latinCount(s2) === 0) return false;
  return cjkCount(s2) <= latinCount(s2) * threshold;
}

function check(label: string, ok: boolean, sample?: string) {
  const mark = ok ? "PASS" : "FAIL";
  console.log(`\n[${mark}] ${label}`);
  if (sample) console.log("   " + sample.split("\n").slice(0, 6).join("\n   "));
  return ok;
}

async function seedEnglishAccount() {
  const exist = await prisma.user.findUnique({ where: { email: EN_EMAIL } });
  if (exist) await prisma.user.delete({ where: { id: exist.id } });

  const user = await prisma.user.create({
    data: {
      email: EN_EMAIL,
      name: "Alex Carter",
      locale: "en",
      region: "United States",
      mobile: "+1-415-555-0142",
      preferredCity: "San Francisco",
      workAuthStatus: "requires_sponsorship",
      snsLinks: [
        { network: "LinkedIn", url: "https://linkedin.com/in/alexcarter" },
        { network: "GitHub", url: "https://github.com/alexcarter" },
      ] as unknown as Prisma.InputJsonValue,
      languages: [
        { name: "English", proficiency: "Native" },
        { name: "Japanese", proficiency: "Business" },
      ] as unknown as Prisma.InputJsonValue,
      tosAcceptedAt: new Date(),
      tosVersion: CURRENT_TOS,
    },
  });
  const uid = user.id;

  await prisma.careerProfile.create({
    data: {
      userId: uid,
      headline: "Senior SRE | Cloud Infrastructure & Observability",
      summary:
        "San Francisco-based SRE with 8 years designing and operating large-scale web services. Led a Kubernetes migration and monitoring redesign that tripled deployment frequency and cut MTTR by 60%.",
    },
  });

  await prisma.careerExperience.createMany({
    data: [
      {
        userId: uid, company: "CloudTech Inc.", title: "Senior SRE",
        startDate: d("2021-04"), endDate: null, location: "San Francisco, CA", employmentType: "full_time",
        description: "Designed and operated the SRE foundation for a large-scale e-commerce platform. Led a Kubernetes migration increasing deployment frequency from twice a month to three times a week.",
        highlights: ["Kubernetes migration tripled deployment frequency", "Cut MTTR by 60%, achieved 99.95% availability"],
        companyNorm: "cloudtech inc.",
      },
      {
        userId: uid, company: "DataWave LLC", title: "Infrastructure Engineer",
        startDate: d("2018-07"), endDate: d("2021-03"), location: "Seattle, WA", employmentType: "full_time",
        description: "Codified data-pipeline infrastructure with Terraform. Redesigned monitoring and cut alert noise by 40%.",
        highlights: ["Codified infra as code with Terraform", "Reduced alert noise by 40%"],
        companyNorm: "datawave llc",
      },
      {
        userId: uid, company: "WebSolutions Co.", title: "Junior Engineer",
        startDate: d("2016-04"), endDate: d("2018-06"), location: "Austin, TX", employmentType: "full_time",
        description: "Developed and operated internal tooling.",
        highlights: ["Built and operated internal tooling"],
        companyNorm: "websolutions co.",
      },
    ],
  });

  await prisma.project.createMany({
    data: [
      {
        userId: uid, name: "Kubernetes Migration", role: "Lead",
        startDate: d("2021-09"), endDate: d("2022-06"),
        description: "Containerized monolithic deployments and enabled continuous delivery three times a week.",
        outcome: "Tripled deployment frequency", techStack: ["Kubernetes", "ArgoCD", "Go"],
      },
      {
        userId: uid, name: "Unified Observability Platform", role: "Design",
        startDate: d("2019-01"), endDate: d("2019-12"),
        description: "Rebuilt the monitoring stack with Prometheus/Grafana.",
        outcome: "Reduced alert noise by 40%", techStack: ["Prometheus", "Grafana"],
      },
    ],
  });

  const skills: Omit<Prisma.SkillCreateManyInput, "nameNorm">[] = [
    { userId: uid, name: "Kubernetes", level: 90, category: "tool", levelSource: "manual" },
    { userId: uid, name: "Terraform", level: 85, category: "tool", levelSource: "manual" },
    { userId: uid, name: "Go", level: 80, category: "framework", levelSource: "manual" },
    { userId: uid, name: "Observability", level: 82, category: "domain", levelSource: "manual" },
    { userId: uid, name: "Incident Response", level: 88, category: "soft", levelSource: "manual" },
  ];
  await prisma.skill.createMany({ data: skills.map((s) => ({ ...s, nameNorm: s.name.toLowerCase() })) });

  await prisma.achievement.createMany({
    data: [
      { userId: uid, title: "Tripled deployment frequency", metricValue: 3, metricUnit: "x", occurredAt: d("2022-06") },
      { userId: uid, title: "Cut MTTR by 60%", metricValue: 60, metricUnit: "%", occurredAt: d("2022-06") },
    ],
  });

  await prisma.education.createMany({
    data: [
      { userId: uid, school: "University of Washington", faculty: "College of Engineering", degree: "B.S.", major: "Computer Science", startDate: d("2012-09"), endDate: d("2016-06") },
    ],
  });

  console.log("Seeded English account:", EN_EMAIL, uid);
  return uid;
}

async function main() {
  const uid = await seedEnglishAccount();
  let allPass = true;

  // 1) resumeParse
  try {
    const { result } = await runResumeParse(EN_RESUME_MD);
    const ok = isEnglish(result.basics?.name) && (result.experiences?.length ?? 0) > 0;
    allPass = check("1) resumeParse (English resume -> structured)", ok,
      `name=${result.basics?.name} / exp=${result.experiences?.length} / edu=${result.educations?.length}`) && allPass;
  } catch (e) {
    allPass = check("1) resumeParse", false, String(e)) && allPass;
  }

  // 2) jdParse
  try {
    const { result } = await runJdParse(EN_JD);
    const ok = isEnglish(result.company) && (result.skills?.length ?? 0) > 0;
    allPass = check("2) jdParse (English JD -> structured)", ok,
      `company=${result.company} / title=${result.title} / skills=${result.skills?.length}`) && allPass;
  } catch (e) {
    allPass = check("2) jdParse", false, String(e)) && allPass;
  }

  // 3) profileGenerate
  try {
    await handleProfileGenerateJob(uid);
    const cp = await prisma.careerProfile.findUnique({ where: { userId: uid } });
    const ok = !!cp && isEnglish(cp.headline) && isEnglish(cp.summary);
    allPass = check("3) profileGenerate (career profile)", ok,
      `headline=${cp?.headline}\nsummary=${cp?.summary?.slice(0, 80)}…`) && allPass;
  } catch (e) {
    allPass = check("3) profileGenerate", false, String(e)) && allPass;
  }

  // 4) resumeGenerate (en) — verify English output + work-auth injection
  try {
    const resume = await prisma.resume.create({
      data: {
        userId: uid, title: "English Resume (test)", resumeType: "en",
        resumeJson: {} as unknown as Prisma.InputJsonValue, status: "draft",
      },
    });
    await handleResumeGenerateJob(resume.id);
    const updated = await prisma.resume.findUnique({ where: { id: resume.id } });
    const json = updated?.resumeJson as any;
    const ok =
      !!json &&
      isEnglish(json?.basics?.name) &&
      (json?.work?.length ?? 0) > 0 &&
      /visa sponsorship/i.test(json?.basics?.summary ?? ""); // EN_EXTRA for requires_sponsorship
    allPass = check("4) resumeGenerate (English resume)", ok,
      `name=${json?.basics?.name} / work=${json?.work?.length} / summary=${json?.basics?.summary?.slice(0, 90)}…`) && allPass;
  } catch (e) {
    allPass = check("4) resumeGenerate", false, String(e)) && allPass;
  }

  console.log("\n========================================");
  console.log(allPass ? "All features PASS (English working correctly)" : "Some FAIL — see above");
  console.log("========================================");
}

main()
  .catch((e) => { console.error("FATAL", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
