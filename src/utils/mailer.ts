import nodemailer from 'nodemailer';
import { env } from '../config/env';

export async function sendResetEmail(to: string, resetUrl: string) {
  let transporter;

  if (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: !!env.SMTP_SECURE,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
    });
  } else {
    if (!env.GMAIL_USER || !env.GMAIL_APP_PASSWORD) {
      throw new Error('Email is not configured: set SMTP_* or GMAIL_* env vars');
    }
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: env.GMAIL_USER,
        pass: env.GMAIL_APP_PASSWORD,
      },
    });
  }

  const from = env.EMAIL_FROM ?? env.GMAIL_USER ?? env.SMTP_USER ?? '';
  const info = await transporter.sendMail({
    from,
    to,
    subject: 'Reset your password',
    html: `
      <p>We received a request to reset your password.</p>
      <p>Click the link below to proceed:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  });
  return info.messageId;
}
