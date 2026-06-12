import { env } from "process";

export const smtpConfig = {
  host: env.SMTP_HOST || "email-smtp.ap-southeast-1.amazonaws.com",
  port: parseInt(env.SMTP_PORT || "465", 10),
  secure: env.SMTP_SSL === "true" || env.SMTP_PORT === "465",
  user: env.SMTP_USER || "",
  password: env.SMTP_PASSWORD || "",
  fromName: env.MAIL_FROM_NAME || "SMILE Platform",
  fromAddress: env.MAIL_FROM_ADDRESS || "noreply@smile-health.com",
};

export const appConfig = {
  baseUrl: env.APP_BASE_URL || "http://localhost:3000",
  passwordResetPath: "/reset-password",
  resetTokenExpiryMs: parseInt(env.RESET_TOKEN_EXPIRY_MS || "3600000", 10), // 1 hour
};
