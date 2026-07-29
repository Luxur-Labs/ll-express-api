import { normalizePhoneE164, toMetaWhatsAppRecipient } from '../utils/whatsappPhone.util';
import { logger } from '../utils/logger';

export type WhatsAppSendPayload = {
  toE164: string;
  message: string;
  event: string;
  metadata?: Record<string, unknown>;
};

function maskPhone(e164: string): string {
  const digits = e164.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '****';
  }
  return `****${digits.slice(-4)}`;
}

function isWhatsAppEnabled(): boolean {
  const v = process.env.WHATSAPP_ENABLED?.toLowerCase()
    ?? process.env.WHATSAPP_INVOICE_NOTIFY?.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function metaConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

async function postWebhook(url: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Webhook ${res.status}: ${t.slice(0, 200)}`);
  }
}

async function sendViaTwilio(toE164: string, bodyText: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) {
    throw new Error('Twilio env vars incomplete');
  }
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const form = new URLSearchParams();
  form.set('From', from.startsWith('whatsapp:') ? from : `whatsapp:${from}`);
  form.set('To', toE164.startsWith('whatsapp:') ? toE164 : `whatsapp:${toE164}`);
  form.set('Body', bodyText);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Twilio ${res.status}: ${t.slice(0, 300)}`);
  }
}

/** Meta WhatsApp Cloud API — https://developers.facebook.com/docs/whatsapp/cloud-api */
async function sendViaMeta(toE164: string, bodyText: string): Promise<string | undefined> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const apiVersion = process.env.WHATSAPP_API_VERSION?.trim() || 'v21.0';
  if (!accessToken || !phoneNumberId) {
    throw new Error('Meta WhatsApp env vars incomplete');
  }

  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  logger.info(
    { to: maskPhone(toE164), phoneNumberId, apiVersion, provider: 'meta' },
    '[whatsapp] sending message',
  );

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toMetaWhatsAppRecipient(toE164),
      type: 'text',
      text: { preview_url: false, body: bodyText },
    }),
  });

  const responseText = await res.text().catch(() => '');

  if (!res.ok) {
    logger.error(
      { to: maskPhone(toE164), status: res.status, response: responseText.slice(0, 500) },
      '[whatsapp] Meta API error',
    );
    throw new Error(`Meta WhatsApp ${res.status}: ${responseText.slice(0, 400)}`);
  }

  let messageId: string | undefined;
  try {
    const parsed = JSON.parse(responseText) as { messages?: Array<{ id?: string }> };
    messageId = parsed.messages?.[0]?.id;
  } catch {
    messageId = undefined;
  }

  logger.info(
    { to: maskPhone(toE164), messageId, provider: 'meta' },
    '[whatsapp] message accepted by Meta',
  );

  return messageId;
}

/**
 * Send a WhatsApp text message to a clinic phone.
 * Priority: Meta Cloud API → webhook → Twilio.
 */
export async function sendWhatsAppText(payload: WhatsAppSendPayload): Promise<void> {
  if (!isWhatsAppEnabled()) {
    logger.warn({ event: payload.event }, '[whatsapp] skipped — WHATSAPP_ENABLED is false');
    return;
  }

  const defaultCc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
  const to = normalizePhoneE164(payload.toE164, defaultCc);
  if (!to) {
    throw new Error('Could not normalize WhatsApp recipient phone');
  }

  const webhook = process.env.WHATSAPP_WEBHOOK_URL?.trim()
    || process.env.WHATSAPP_INVOICE_WEBHOOK_URL?.trim();

  try {
    if (metaConfigured()) {
      await sendViaMeta(to, payload.message);
      return;
    }

    if (webhook) {
      logger.info({ to: maskPhone(to), event: payload.event, provider: 'webhook' }, '[whatsapp] sending via webhook');
      await postWebhook(webhook, {
        event: payload.event,
        channel: 'whatsapp',
        provider: 'meta',
        toE164: to,
        message: payload.message,
        ...payload.metadata,
      });
      logger.info({ to: maskPhone(to), event: payload.event }, '[whatsapp] webhook accepted');
      return;
    }

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    if (twilioSid) {
      logger.info({ to: maskPhone(to), event: payload.event, provider: 'twilio' }, '[whatsapp] sending via Twilio');
      await sendViaTwilio(to, payload.message);
      logger.info({ to: maskPhone(to), event: payload.event }, '[whatsapp] Twilio accepted');
      return;
    }

    throw new Error(
      'WhatsApp is enabled but no provider is configured (Meta, webhook, or Twilio)',
    );
  } catch (error) {
    logger.error(
      { err: error, to: maskPhone(to), event: payload.event, ...payload.metadata },
      '[whatsapp] send failed',
    );
    throw error;
  }
}

export function buildClinicOtpMessage(code: string, clinicName: string): string {
  const company = process.env.COMPANY_SHORT_NAME || 'Luxur Dental Labs';
  return (
    `Your ${company} clinic login code is ${code}. ` +
    `Valid for 10 minutes. Do not share this code. Clinic: ${clinicName}.`
  );
}
