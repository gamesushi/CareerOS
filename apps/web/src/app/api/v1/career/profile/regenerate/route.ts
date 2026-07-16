import { handler, ok, requireUser } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

export const POST = handler(async () => {
  const { userId } = await requireUser();
  await aiQueue.add("profile_generate", { userId }, { jobId: `profile-${userId}-${Date.now()}` });
  return ok({ queued: true }, 202);
});
