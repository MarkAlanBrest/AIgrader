/**
 * Email sending utility using nodemailer
 */

import nodemailer from "nodemailer";

export interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * Send an email using SMTP
 */
export async function sendEmail(
  config: SmtpConfig,
  options: EmailOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });

    const htmlBody =
      options.html || options.text.replace(/\n/g, "<br>");

    const info = await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: htmlBody,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send email" };
  }
}

/**
 * Send emails to multiple recipients
 */
export async function sendBulkEmails(
  config: SmtpConfig,
  emails: EmailOptions[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const email of emails) {
    const result = await sendEmail(config, email);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${email.to}: ${result.error}`);
    }
  }

  return { sent, failed, errors };
}
