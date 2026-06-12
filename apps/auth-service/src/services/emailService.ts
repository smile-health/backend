import nodemailer from "nodemailer";
import { smtpConfig } from "../config/smtpConfig";
import logger from "../utils/logger";

const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port,
  secure: smtpConfig.secure,
  auth: {
    user: smtpConfig.user,
    pass: smtpConfig.password,
  },
});

transporter.verify((error) => {
  if (error) {
    logger.warn(`EmailService: SMTP verification failed: ${error.message}`);
  } else {
    logger.info("EmailService: SMTP connection verified successfully");
  }
});

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(params: SendEmailParams): Promise<void> {
  const { to, subject, html } = params;

  const mailOptions = {
    from: `"${smtpConfig.fromName}" <${smtpConfig.fromAddress}>`,
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    logger.info(
      `EmailService: Email sent successfully to ${to}, messageId: ${info.messageId}`
    );
  } catch (error: any) {
    logger.error(
      `EmailService: Failed to send email to ${to}: ${error.message}`
    );
    throw new Error("Failed to send password reset email");
  }
}

export function buildPasswordResetEmailHtml(resetLink: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1a73e8; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 24px; }
    .content { background-color: #f9f9f9; padding: 30px; border: 1px solid #ddd; }
    .button { display: inline-block; padding: 12px 24px; background-color: #1a73e8; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
    .button:hover { background-color: #1557b0; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; text-align: center; }
    .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 20px 0; font-size: 13px; color: #856404; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password. Click the button below to create a new password:</p>
      <p style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </p>
      <div class="warning">
        <strong>⚠️ Link expires in 1 hour.</strong> If you did not request a password reset, please ignore this email.
      </div>
      <p>If the button above does not work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 13px; color: #1a73e8;">${resetLink}</p>
    </div>
    <div class="footer">
      <p>&copy; SMILE Platform. This is an automated message, please do not reply.</p>
    </div>
  </div>
</body>
</html>`;
}
