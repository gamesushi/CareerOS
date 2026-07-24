"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExperienceTab } from "@/components/knowledge/experience-tab";
import { ProjectTab } from "@/components/knowledge/project-tab";
import { AchievementTab } from "@/components/knowledge/achievement-tab";
import { EducationTab } from "@/components/knowledge/education-tab";
import { HonorTab } from "@/components/knowledge/honor-tab";
import { useT } from "@/lib/i18n/provider";

function KnowledgeTabs() {
  const t = useT();
  const router = useRouter();
  const tab = useSearchParams().get("tab") ?? "experiences";

  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(`/knowledge?tab=${v}`)}>
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="experiences">{t("knowledge.tab.experiences")}</TabsTrigger>
          <TabsTrigger value="projects">{t("knowledge.tab.projects")}</TabsTrigger>
          <TabsTrigger value="achievements">{t("knowledge.tab.achievements")}</TabsTrigger>
          <TabsTrigger value="educations">{t("knowledge.tab.educations")}</TabsTrigger>
          <TabsTrigger value="honors">{t("knowledge.tab.honors")}</TabsTrigger>
        </TabsList>
        <a href="/knowledge/graph" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          {t("knowledge.graphLink")}
        </a>
      </div>
      <TabsContent value="experiences"><ExperienceTab /></TabsContent>
      <TabsContent value="projects"><ProjectTab /></TabsContent>
      <TabsContent value="achievements"><AchievementTab /></TabsContent>
      <TabsContent value="educations"><EducationTab /></TabsContent>
      <TabsContent value="honors"><HonorTab /></TabsContent>
    </Tabs>
  );
}

function KnowledgeHeader() {
  const t = useT();
  return (
    <div>
      <h1 className="text-xl font-semibold">{t("knowledge.title")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("knowledge.desc")}
      </p>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <KnowledgeHeader />
      <Suspense>
        <KnowledgeTabs />
      </Suspense>
    </div>
  );
}
