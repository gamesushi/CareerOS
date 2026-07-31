import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginFormWrapper from "./login-form";

export default async function LoginPage() {
  const session = await getSession();
  if (session?.user) redirect("/dashboard");

  // 本地密码登录（credentials）始终启用，是除 Google 之外的基线登录方式。
  const passwordEnabled = true;
  // 是否启用 Google OAuth（需配 AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET）。
  const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  // 开发邮箱直登仅本地开发启用（生产绝不启用，见 auth.ts 的 fail-safe 保护）。
  const devEnabled =
    process.env.AUTH_DEV_CREDENTIALS === "true" && process.env.NODE_ENV !== "production";

  return (
    <LoginFormWrapper
      passwordEnabled={passwordEnabled}
      googleEnabled={googleEnabled}
      devEnabled={devEnabled}
    />
  );
}
