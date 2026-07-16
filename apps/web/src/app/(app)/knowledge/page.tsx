"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExperienceTab } from "@/components/knowledge/experience-tab";
import { ProjectTab } from "@/components/knowledge/project-tab";
import { AchievementTab } from "@/components/knowledge/achievement-tab";
import { EducationTab } from "@/components/knowledge/education-tab";

function KnowledgeTabs() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") ?? "experiences";

  return (
    <Tabs value={tab} onValueChange={(v) => router.replace(`/knowledge?tab=${v}`)}>
      <TabsList>
        <TabsTrigger value="experiences">工作经历</TabsTrigger>
        <TabsTrigger value="projects">项目</TabsTrigger>
        <TabsTrigger value="achievements">成果</TabsTrigger>
        <TabsTrigger value="educations">教育</TabsTrigger>
      </TabsList>
      <TabsContent value="experiences"><ExperienceTab /></TabsContent>
      <TabsContent value="projects"><ProjectTab /></TabsContent>
      <TabsContent value="achievements"><AchievementTab /></TabsContent>
      <TabsContent value="educations"><EducationTab /></TabsContent>
    </Tabs>
  );
}

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">职业知识库</h1>
        <p className="text-sm text-muted-foreground">
          所有简历都从这里生成——维护的是数据，不是文档。
        </p>
      </div>
      <Suspense>
        <KnowledgeTabs />
      </Suspense>
    </div>
  );
}
