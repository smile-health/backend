// email.config.ts
import nodemailer from "nodemailer";
import { env } from "process";

export const emailTransport = nodemailer.createTransport({
  host: env.SMTP_HOST || "email-smtp.ap-southeast-1.amazonaws.com",
  secureConnection: env.SMTP_SSL || true,
  port: env.SMTP_PORT || 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASSWORD,
  },
});
