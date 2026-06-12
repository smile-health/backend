import crypto from "crypto";
import { db } from "../common/infrastructure/database";
import { appConfig } from "../config/smtpConfig";
import logger from "../utils/logger";

export interface PasswordResetTokenRecord {
  id: number;
  user_id: string;
  email: string;
  token: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getExpiryDate(): Date {
  const expiry = new Date();
  expiry.setTime(expiry.getTime() + appConfig.resetTokenExpiryMs);
  return expiry;
}

export function buildResetLink(token: string): string {
  const baseUrl = appConfig.baseUrl.replace(/\/+$/, "");
  const path = appConfig.passwordResetPath.replace(/\/+$/, "");
  return `${baseUrl}${path}?token=${token}`;
}

export async function storeToken(
  userId: string,
  email: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  // Invalidate any existing unused tokens for this user
  await db
    .updateTable("password_reset_tokens")
    .set({ used_at: new Date() })
    .where("user_id", "=", userId)
    .where("used_at", "is", null)
    .where("expires_at", ">", new Date())
    .execute();

  // Insert the new token
  await db
    .insertInto("password_reset_tokens")
    .values({
      user_id: userId,
      email,
      token,
      expires_at: expiresAt,
    })
    .execute();

  logger.info(
    `PasswordResetService: Token stored for user ${userId} (${email}), expires at ${expiresAt.toISOString()}`
  );
}

export async function validateToken(
  token: string
): Promise<PasswordResetTokenRecord | null> {
  const record = await db
    .selectFrom("password_reset_tokens")
    .selectAll()
    .where("token", "=", token)
    .where("used_at", "is", null)
    .where("expires_at", ">", new Date())
    .executeTakeFirst();

  if (!record) {
    return null;
  }

  return record;
}

export async function markTokenAsUsed(tokenId: number): Promise<void> {
  await db
    .updateTable("password_reset_tokens")
    .set({ used_at: new Date() })
    .where("id", "=", tokenId)
    .execute();
}

export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .deleteFrom("password_reset_tokens")
    .where("expires_at", "<=", new Date())
    .where("used_at", "is not", null)
    .execute();

  const count = Number(result[0]?.numDeletedRows ?? 0);
  if (count > 0) {
    logger.info(
      `PasswordResetService: Cleaned up ${count} expired/used tokens`
    );
  }
  return count;
}

export async function findTokenByValue(
  token: string
): Promise<PasswordResetTokenRecord | null> {
  return validateToken(token);
}
