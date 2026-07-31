import { prisma, Prisma } from "@careeros/db";
import { meUpdateInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { careerProfile: true },
  });
  if (!user) throw new ApiError(404, "not_found", "用户不存在");
  const { weknoraApiKey, ...safe } = user;
  void weknoraApiKey;
  return ok(safe);
});

export const PUT = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, meUpdateInput);

  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const privacy = input.privacy
    ? { ...(current.privacy as Record<string, boolean>), ...input.privacy }
    : undefined;

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      image: input.image,
      locale: input.locale,
      region: input.region,
      mobile: input.mobile,
      preferredCity: input.preferredCity,
      workAuthStatus: input.workAuthStatus,
      snsLinks: input.snsLinks as unknown as Prisma.InputJsonValue | undefined,
      languages: input.languages as unknown as Prisma.InputJsonValue | undefined,
      jobStatus: input.jobStatus,
      ...(privacy ? { privacy } : {}),
    },
  });

  // 职业画像（headline/summary/personal）随同一请求落库，避免前端并发两次写。
  if (input.headline !== undefined || input.summary !== undefined || input.personal !== undefined) {
    const personal = (input.personal ?? {}) as Prisma.InputJsonValue;
    await prisma.careerProfile.upsert({
      where: { userId },
      create: {
        userId,
        headline: input.headline ?? null,
        summary: input.summary ?? null,
        personal,
      },
      update: {
        ...(input.headline !== undefined ? { headline: input.headline } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.personal !== undefined ? { personal } : {}),
      },
    });
  }

  const full = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { careerProfile: true },
  });
  const { weknoraApiKey, ...safe } = full;
  void weknoraApiKey;
  return ok(safe);
});
