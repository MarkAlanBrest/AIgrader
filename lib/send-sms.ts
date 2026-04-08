/**
 * SMS sending utility using Twilio
 */

import twilio from "twilio";

export interface SmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export interface SmsOptions {
  to: string;
  body: string;
}

/**
 * Send an SMS message via Twilio
 */
export async function sendSms(
  config: SmsConfig,
  options: SmsOptions
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    const client = twilio(config.accountSid, config.authToken);

    const message = await client.messages.create({
      body: options.body,
      from: config.fromNumber,
      to: options.to,
    });

    return { success: true, sid: message.sid };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to send SMS" };
  }
}

/**
 * Send SMS messages to multiple recipients
 */
export async function sendBulkSms(
  config: SmsConfig,
  messages: SmsOptions[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const msg of messages) {
    const result = await sendSms(config, msg);
    if (result.success) {
      sent++;
    } else {
      failed++;
      errors.push(`${msg.to}: ${result.error}`);
    }
  }

  return { sent, failed, errors };
}
