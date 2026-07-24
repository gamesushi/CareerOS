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
  const { weknoraApiKey: _key, ...safe } = user;
  return ok(safe);
});

export const PUT = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, meUpdateInput);

  const current = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const privacy = input.privacy
    ? { ...(current.privacy as Record<string, boolean>), ...input.privacy }
    : undefined;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      name: input.name,
      avatarUrl: input.avatarUrl,
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
  const { weknoraApiKey: _key, ...safe } = user;
  return ok(safe);
});
