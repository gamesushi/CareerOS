import NextAuth from "next-auth";
import type { Session } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@careeros/db";
import { CURRENT_TOS_VERSION } from "@/lib/tos";
import { verifyPassword } from "@/lib/password";

// ============ 登录审计辅助 ============
function extractClientIp(req?: Request): string | null {
  if (!req) return null;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}
function extractUserAgent(req?: Request): string | null {
  return req?.headers.get("user-agent") ?? null;
}

// 登录方式：
//  - Google OAuth：生产主线，邮箱由 Google 验证（天然满足邮箱验证要求）。
//  - 本地密码（credentials）：始终启用的基线登录，配合 /register 自助注册与 /forgot-password 找回。
//  - dev 邮箱直登：仅开发占位，fail-safe（生产绝不启用），见下方 devCredentialsEnabled 判断。
const providers = [];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      authorization: { params: { scope: "openid email profile" } },
      // 允许同邮箱的 Google 账号与既有账号（如本地密码创建的）自动关联，避免重复账号。
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// 本地密码登录速率上限：同一邮箱 10 分钟内失败 5 次即临时封锁。
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_FAILS = 5;

async function recentFailCount(email: string): Promise<number> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
  return prisma.loginLog.count({
    where: { email, success: false, createdAt: { gt: since } },
  });
}

function logFail(
  method: "password" | "dev",
  email: string | null,
  ip: string | null,
  ua: string | null,
  reason: string,
) {
  return prisma.loginLog.create({
    data: { email: email || null, method, success: false, reason, ip, userAgent: ua },
  });
}

// 本地密码登录（credentials）：始终启用，是除 Google 之外的基线登录方式。
providers.push(
  Credentials({
    id: "credentials",
    name: "Email & Password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
      tosAccepted: { label: "TOS", type: "text" }, // 登录页勾选「同意用户协议与隐私政策」后传 "true"
    },
    async authorize(credentials, request) {
      const email = String(credentials?.email ?? "").trim().toLowerCase();
      const password = String(credentials?.password ?? "");
      const ip = extractClientIp(request);
      const ua = extractUserAgent(request);

      // 速率限制：同邮箱近 10 分钟失败次数超阈值则拒绝（防暴）。
      if ((await recentFailCount(email)) >= RATE_LIMIT_MAX_FAILS) {
        await logFail("password", email || null, ip, ua, "rate_limited");
        return null;
      }
      if (!email || !email.includes("@")) {
        await logFail("password", email || null, ip, ua, "invalid_email");
        return null;
      }

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        await logFail("password", email, ip, ua, "invalid_credentials");
        return null;
      }
      if (user.deletedAt) {
        await logFail("password", email, ip, ua, "deleted");
        return null;
      }
      if (user.bannedAt) {
        await logFail("password", email, ip, ua, "banned");
        return null;
      }
      if (!user.passwordHash) {
        // 该账号没有本地密码（如仅 Google 登录的账号）：提示用对应方式登录。
        await logFail("password", email, ip, ua, "no_password");
        return null;
      }
      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        await logFail("password", email, ip, ua, "wrong_password");
        return null;
      }

      // 同意留痕：勾选后记录同意时间与条款版本（PIPL 证据）。
      const tosFields =
        String(credentials?.tosAccepted ?? "") === "true"
          ? { tosAcceptedAt: new Date(), tosVersion: CURRENT_TOS_VERSION }
          : {};
      await prisma.user.update({ where: { id: user.id }, data: tosFields });

      // 成功登录审计
      await prisma.loginLog.create({
        data: { userId: user.id, email: user.email, method: "password", success: true, ip, userAgent: ua },
      });
      return { id: user.id, email: user.email, name: user.name };
    },
  }),
);

// dev 邮箱直登（仅开发占位）：AUTH_DEV_CREDENTIALS=true 且非 production 时注册。
// 生产即使误设该变量也不会启用（fail-safe），避免任意邮箱可冒充登录。
const devCredentialsEnabled =
  process.env.AUTH_DEV_CREDENTIALS === "true" && process.env.NODE_ENV !== "production";

if (devCredentialsEnabled) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev Email",
      credentials: {
        email: { label: "Email", type: "email" },
        tosAccepted: { label: "TOS", type: "text" },
      },
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const ip = extractClientIp(request);
        const ua = extractUserAgent(request);

        if ((await recentFailCount(email)) >= RATE_LIMIT_MAX_FAILS) {
          await logFail("dev", email || null, ip, ua, "rate_limited");
          return null;
        }
        if (!email || !email.includes("@")) {
          await logFail("dev", email || null, ip, ua, "invalid_email");
          return null;
        }

        // 同意留痕：勾选后记录同意时间与条款版本（PIPL 证据）。
        // 未带同意标记的登录（如脚本直调）不落痕，进入应用后由 TosGate 弹窗强制补确认。
        const tosFields =
          String(credentials?.tosAccepted ?? "") === "true"
            ? { tosAcceptedAt: new Date(), tosVersion: CURRENT_TOS_VERSION }
            : {};
        const user = await prisma.user.upsert({
          where: { email },
          update: { ...tosFields, emailVerified: new Date() },
          create: { email, name: email.split("@")[0], ...tosFields, emailVerified: new Date() },
        });
        await prisma.loginLog.create({
          data: { userId: user.id, email: user.email, method: "dev", success: true, ip, userAgent: ua },
        });
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  // 部署到非 localhost（如容器/域名）时，NextAuth 回调与 /api/auth 需要信任 Host。
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers,
  // 自定义日志：JWTSessionError 发生在 AUTH_SECRET 轮换后旧会话 cookie 失效
  // （签名对不上，jose 解不开 JWE）。这属预期降级，已在 getSession 中兜底为「无会话」，
  // 无需在浏览器控制台刷红色错误。其余 auth 错误照常打印，不丢可观测性。
  logger: {
    error: (...args: unknown[]) => {
      const code =
        typeof args[0] === "string"
          ? args[0]
          : (args[0] as { code?: string } | undefined)?.code;
      if (code === "JWTSessionError") return;
      console.error("[auth][error]", ...args);
    },
    warn: (...args: unknown[]) => {
      console.warn("[auth][warn]", ...args);
    },
    debug: (...args: unknown[]) => {
      if (process.env.AUTH_DEBUG === "true") console.debug("[auth][debug]", ...args);
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.uid = user.id;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        token.role = dbUser?.role ?? "user";
        token.emailVerified = dbUser?.emailVerified ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = token.uid as string;
        session.user.role = (token.role as string) ?? "user";
        session.user.emailVerified = (token.emailVerified as Date | null) ?? null;
      }
      return session;
    },
    // 登录审计：Google 成功登录在此记录（password/dev 的成功/失败已在 authorize 内记录，避免重复）。
    // 注：beta.31 的 signIn 类型未暴露 request，运行时实际存在，用窄断言取出客户端 IP/UA。
    async signIn(params) {
      const { user, account } = params;
      const request = (params as { request?: Request }).request;
      if (account?.provider === "google") {
        // Google 已验证邮箱归属：直接置 emailVerified（幂等）。
        await prisma.user
          .update({ where: { id: user.id }, data: { emailVerified: new Date() } })
          .catch(() => {});
        await prisma.loginLog.create({
          data: {
            userId: user.id,
            email: user.email,
            method: "google",
            success: true,
            ip: extractClientIp(request),
            userAgent: extractUserAgent(request),
          },
        });
      }
      return true;
    },
  },
});

// 容错版 auth()：AUTH_SECRET 轮换 / 会话 cookie 失效（旧 JWT 签名对不上）时，
// Auth.js 会抛 JWTSessionError，若直接在 Server Component 里 await auth() 会整页 500。
// 这里降级为「无会话」，让页面正常渲染登录态，用户重新登录即可拿到新 token。
export async function getSession(): Promise<Session | null> {
  try {
    return await auth();
  } catch (e) {
    const code = (e as { code?: string } | undefined)?.code;
    // JWTSessionError 已在 logger 层静音，这里不再重复打印；其他解码错误仍暴露以便排查。
    if (code !== "JWTSessionError" && process.env.NODE_ENV !== "production") {
      console.error(
        "[auth] getSession 解码失败（多半是 AUTH_SECRET 轮换后旧会话 cookie 失效，已降级为无会话）：",
        e,
      );
    }
    return null;
  }
}

