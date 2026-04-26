/**
 * Optional WhatsApp notification when a billing invoice is finalized.
 *
 * Setup options:
 * 1) Webhook — set WHATSAPP_INVOICE_WEBHOOK_URL to receive a JSON POST (e.g. n8n, Make.com, Zapier)
 *    and send WhatsApp from there (Meta Cloud API, Twilio, etc.).
 * 2) Twilio — set TWILIO_* vars below; sends a text body to clinic contactNumber (WhatsApp channel).
 *
 * Enable with WHATSAPP_INVOICE_NOTIFY=true
 */

import type { Clinic } from '@prisma/client';

type InvoiceNotifyPayload = {
  id: string;
  invoiceNumber: string;
  periodLabel: string;
  netPayable: number;
  clinic: Pick<Clinic, 'clinicName' | 'contactNumber'>;
};

function isNotifyEnabled(): boolean {
  const v = process.env.WHATSAPP_INVOICE_NOTIFY?.toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** E.164 for WhatsApp; 10-digit local numbers get default country code (e.g. 91). */
export function normalizePhoneForWhatsApp(
  raw: string | null | undefined,
  defaultCountryCode: string
): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, '');
  if (!digits.length) return null;
  if (raw.trim().startsWith('+')) {
    return `+${digits}`;
  }
  const cc = defaultCountryCode.replace(/\D/g, '') || '91';
  if (digits.length === 10) {
    return `+${cc}${digits}`;
  }
  return `+${digits}`;
}

function buildMessage(p: InvoiceNotifyPayload): string {
  const amt = Number(p.netPayable).toFixed(2);
  return (
    `Tax invoice ${p.invoiceNumber} is ready for ${p.clinic.clinicName}. ` +
    `Period: ${p.periodLabel}. Net payable: ₹${amt}. — ${process.env.COMPANY_SHORT_NAME || 'Luxur Dental Labs'}`
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

/**
 * Fire-and-forget from the billing controller after invoice is saved.
 * Never throws to the HTTP layer; logs errors only.
 */
export async function notifyClinicInvoiceWhatsApp(data: {
  id: string;
  invoiceNumber: string;
  periodLabel: string;
  netPayable: number;
  clinic: { clinicName: string; contactNumber: string };
}): Promise<void> {
  if (!isNotifyEnabled()) return;

  const defaultCc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
  const to = normalizePhoneForWhatsApp(data.clinic.contactNumber, defaultCc);
  if (!to) {
    console.warn('[whatsapp-invoice] Skipping: could not normalize clinic contactNumber');
    return;
  }

  const message = buildMessage({
    id: data.id,
    invoiceNumber: data.invoiceNumber,
    periodLabel: data.periodLabel,
    netPayable: data.netPayable,
    clinic: data.clinic,
  });

  const webhook = process.env.WHATSAPP_INVOICE_WEBHOOK_URL?.trim();
  if (webhook) {
    await postWebhook(webhook, {
      event: 'billing_invoice_created',
      channel: 'whatsapp',
      toE164: to,
      message,
      invoice: {
        id: data.id,
        invoiceNumber: data.invoiceNumber,
        periodLabel: data.periodLabel,
        netPayable: data.netPayable,
        clinicName: data.clinic.clinicName,
      },
    });
    return;
  }

  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  if (twilioSid) {
    await sendViaTwilio(to, message);
    return;
  }

  console.warn(
    '[whatsapp-invoice] WHATSAPP_INVOICE_NOTIFY is on but neither WHATSAPP_INVOICE_WEBHOOK_URL nor Twilio is configured'
  );
}
