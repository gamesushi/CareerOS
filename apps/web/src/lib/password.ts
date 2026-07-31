/**
 * 密码哈希与重置令牌工具。
 *
 * 使用 Node 内置 crypto.scrypt（无需 bcrypt 等原生/外部依赖，规避 arm64 原生编译坑）。
 * 存储格式："<saltHex>:<hashHex>"，每次哈希使用随机 16 字节 salt。
 */
import { randomBytes, scrypt, timingSafeEqual, createHash } from "crypto";

const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, KEYLEN, (err, derived) => {
      if (err) return reject(err);
      resolve(`${salt}:${derived.toString("hex")}`);
    });
  });
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, hash] = stored.split(":");
    if (!salt || !hash) return resolve(false);
    scrypt(password, salt, KEYLEN, (err, derived) => {
      if (err) return reject(err);
      try {
        resolve(timingSafeEqual(Buffer.from(hash, "hex"), derived));
      } catch {
        resolve(false);
      }
    });
  });
}

// ============ 密码找回 token ============
// 原始 token 只出现在重置链接里，DB 仅存其 SHA-256 哈希，避免数据库泄露即导致可重置。
export function generateResetToken(): { raw: string; hashed: string } {
  const raw = randomBytes(32).toString("hex");
  const hashed = hashResetToken(raw);
  return { raw, hashed };
}

export function hashResetToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
