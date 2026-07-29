import crypto from 'crypto';

import bcrypt from 'bcryptjs';

import { prisma } from '../utils/prisma';
import { normalizePhoneE164, phonesMatch } from '../utils/whatsappPhone.util';
import { buildClinicOtpMessage, sendWhatsAppText } from './whatsappMeta.service';
import { hashPassword, verifyPassword } from '../utils/password';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export const OTP_PURPOSE_CLINIC_LOGIN = 'clinic_login';
export const OTP_PURPOSE_CLINIC_PASSWORD_RESET = 'clinic_password_reset';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_RESENDS = 10;
const MAX_OTP_SENDS = MAX_OTP_RESENDS + 1;
const OTP_SEND_WINDOW_MS = 60 * 60 * 1000;

export type OtpRequestResult = {
  sendsUsed: number;
  resendsRemaining: number;
  cooldownSeconds: number;
};

const GENERIC_OTP_MESSAGE =
  'If your number is registered, a verification code will be sent on WhatsApp.';

export function getGenericOtpMessage(): string {
  return GENERIC_OTP_MESSAGE;
}

function maskContact(contactNumber: string): string {
  const digits = contactNumber.replace(/\D/g, '');
  if (digits.length <= 4) {
    return '****';
  }
  return `****${digits.slice(-4)}`;
}

function generateOtpCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

function otpMessage(code: string, clinicName: string, purpose: string): string {
  const company = process.env.COMPANY_SHORT_NAME || 'Luxur Dental Labs';
  if (purpose === OTP_PURPOSE_CLINIC_PASSWORD_RESET) {
    return `Your ${company} password reset code is ${code}. Valid for 10 minutes. Do not share. Clinic: ${clinicName}.`;
  }
  return buildClinicOtpMessage(code, clinicName);
}

export async function findActiveClinicByContactNumber(contactNumber: string) {
  const defaultCc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
  const clinics = await prisma.clinic.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  return clinics.find((c) => phonesMatch(c.contactNumber, contactNumber, defaultCc)) ?? null;
}

async function findClinicPortalUser(clinicId: string) {
  return prisma.user.findFirst({
    where: { clinicId, role: 'CLINIC' },
    include: { employeeType: true, technicianGroup: true, clinic: true },
  });
}

export async function clinicPortalAccountStatus(contactNumber: string) {
  const clinic = await findActiveClinicByContactNumber(contactNumber);
  if (!clinic) {
    return { registered: false, hasPassword: false };
  }
  const user = await findClinicPortalUser(clinic.id);
  return {
    registered: true,
    hasPassword: Boolean(user && user.mustChangePassword === false),
    clinicName: clinic.clinicName,
  };
}

async function countRecentOtpSends(phoneE164: string, purpose: string): Promise<number> {
  return prisma.otpChallenge.count({
    where: {
      phoneE164,
      purpose,
      createdAt: { gte: new Date(Date.now() - OTP_SEND_WINDOW_MS) },
    },
  });
}

async function recordOtpSendAttempt(phoneE164: string, purpose: string) {
  await prisma.otpChallenge.create({
    data: {
      phoneE164,
      clinicId: null,
      purpose,
      codeHash: await bcrypt.hash(crypto.randomUUID(), 10),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
}

export async function requestClinicOtp(
  contactNumber: string,
  purpose: string = OTP_PURPOSE_CLINIC_LOGIN,
): Promise<OtpRequestResult> {
  const defaultCc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
  const phoneE164 = normalizePhoneE164(contactNumber, defaultCc);
  if (!phoneE164) {
    throw new Error('Invalid mobile number');
  }

  const sendsUsed = await countRecentOtpSends(phoneE164, purpose);
  if (sendsUsed >= MAX_OTP_SENDS) {
    throw new Error('Maximum resend limit reached. Try again later.');
  }

  const recent = await prisma.otpChallenge.findFirst({
    where: {
      phoneE164,
      purpose,
      createdAt: { gte: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (recent) {
    const cooldownSeconds = Math.ceil(
      (recent.createdAt.getTime() + RESEND_COOLDOWN_MS - Date.now()) / 1000,
    );
    throw new Error(`Please wait ${Math.max(cooldownSeconds, 1)} seconds before requesting another code`);
  }

  const clinic = await findActiveClinicByContactNumber(contactNumber);
  if (!clinic) {
    await recordOtpSendAttempt(phoneE164, purpose);
    logger.warn(
      { contact: maskContact(contactNumber), purpose },
      '[clinic-otp] no active clinic matched — WhatsApp not sent (UI still shows generic success)',
    );
    const nextSendsUsed = sendsUsed + 1;
    return {
      sendsUsed: nextSendsUsed,
      resendsRemaining: Math.max(MAX_OTP_RESENDS - (nextSendsUsed - 1), 0),
      cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    };
  }

  logger.info(
    { contact: maskContact(contactNumber), clinicId: clinic.id, clinicName: clinic.clinicName, purpose },
    '[clinic-otp] clinic matched',
  );

  if (purpose === OTP_PURPOSE_CLINIC_PASSWORD_RESET) {
    const user = await findClinicPortalUser(clinic.id);
    if (!user || user.mustChangePassword) {
      await recordOtpSendAttempt(phoneE164, purpose);
      const nextSendsUsed = sendsUsed + 1;
      return {
        sendsUsed: nextSendsUsed,
        resendsRemaining: Math.max(MAX_OTP_RESENDS - (nextSendsUsed - 1), 0),
        cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
      };
    }
  }

  const clinicPhoneE164 = normalizePhoneE164(clinic.contactNumber, defaultCc);
  if (!clinicPhoneE164) {
    await recordOtpSendAttempt(phoneE164, purpose);
    const nextSendsUsed = sendsUsed + 1;
    return {
      sendsUsed: nextSendsUsed,
      resendsRemaining: Math.max(MAX_OTP_RESENDS - (nextSendsUsed - 1), 0),
      cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
    };
  }

  const code = generateOtpCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  if (env.NODE_ENV === 'development') {
    logger.info(
      { contact: maskContact(contactNumber), clinicId: clinic.id, code, purpose },
      '[clinic-otp] DEV ONLY — OTP code (also sent via WhatsApp when Meta accepts)',
    );
  }

  await prisma.otpChallenge.create({
    data: {
      phoneE164,
      clinicId: clinic.id,
      purpose,
      codeHash,
      expiresAt,
    },
  });

  await sendWhatsAppText({
    toE164: clinicPhoneE164,
    message: otpMessage(code, clinic.clinicName, purpose),
    event: purpose,
    metadata: { clinicId: clinic.id, clinicName: clinic.clinicName },
  });

  logger.info(
    { contact: maskContact(contactNumber), clinicId: clinic.id, purpose },
    '[clinic-otp] WhatsApp send completed',
  );

  const nextSendsUsed = sendsUsed + 1;
  return {
    sendsUsed: nextSendsUsed,
    resendsRemaining: Math.max(MAX_OTP_RESENDS - (nextSendsUsed - 1), 0),
    cooldownSeconds: Math.ceil(RESEND_COOLDOWN_MS / 1000),
  };
}

async function consumeOtpChallenge(contactNumber: string, code: string, purpose: string) {
  const clinic = await findActiveClinicByContactNumber(contactNumber);
  if (!clinic) {
    throw new Error('Invalid verification code');
  }

  const challenge = await prisma.otpChallenge.findFirst({
    where: {
      clinicId: clinic.id,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!challenge) {
    throw new Error('Invalid verification code');
  }

  if (challenge.attempts >= MAX_ATTEMPTS) {
    throw new Error('Invalid verification code');
  }

  const ok = await bcrypt.compare(String(code).trim(), challenge.codeHash);
  if (!ok) {
    await prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { attempts: { increment: 1 } },
    });
    throw new Error('Invalid verification code');
  }

  await prisma.otpChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const defaultCc = process.env.WHATSAPP_DEFAULT_COUNTRY_CODE || '91';
  const phoneE164 = normalizePhoneE164(clinic.contactNumber, defaultCc) ?? challenge.phoneE164;

  return { clinic, phoneE164 };
}

async function getOrCreateClinicPortalUser(clinic: {
  id: string;
  clinicName: string;
  contactNumber: string;
}) {
  let user = await findClinicPortalUser(clinic.id);
  let isNewUser = false;

  if (!user) {
    isNewUser = true;
    const email = `clinic+${clinic.id}@portal.luxur`;
    user = await prisma.user.create({
      data: {
        email,
        name: clinic.clinicName,
        role: 'CLINIC',
        clinicId: clinic.id,
        contact: clinic.contactNumber,
        passwordHash: await hashPassword(crypto.randomUUID()),
        isActive: true,
        mustChangePassword: true,
      },
      include: { employeeType: true, technicianGroup: true, clinic: true },
    });
  }

  return { user, isNewUser };
}

export async function verifyClinicLoginOtp(contactNumber: string, code: string) {
  const { clinic } = await consumeOtpChallenge(contactNumber, code, OTP_PURPOSE_CLINIC_LOGIN);
  const { user } = await getOrCreateClinicPortalUser(clinic);

  if (!user.isActive) {
    throw new Error('This clinic account has been deactivated');
  }

  return { user, clinic };
}

export async function loginClinicWithPassword(contactNumber: string, password: string) {
  const clinic = await findActiveClinicByContactNumber(contactNumber);
  if (!clinic) {
    throw new Error('Invalid phone number or password');
  }

  const user = await findClinicPortalUser(clinic.id);
  if (!user) {
    throw new Error('No password set yet. Use OTP login for your first sign in.');
  }

  if (user.mustChangePassword) {
    throw new Error('Please complete first-time setup using OTP login.');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new Error('Invalid phone number or password');
  }

  if (!user.isActive) {
    throw new Error('This clinic account has been deactivated');
  }

  return { user, clinic };
}

export async function setClinicPortalPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== 'CLINIC') {
    throw new Error('Clinic account not found');
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });
}

export async function resetClinicPassword(
  contactNumber: string,
  code: string,
  currentPassword: string,
  newPassword: string,
) {
  const { clinic } = await consumeOtpChallenge(
    contactNumber,
    code,
    OTP_PURPOSE_CLINIC_PASSWORD_RESET,
  );

  const user = await findClinicPortalUser(clinic.id);
  if (!user || user.mustChangePassword) {
    throw new Error('Clinic account is not ready for password reset');
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    throw new Error('Current password is incorrect');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
  });

  return { user, clinic };
}

/** @deprecated use requestClinicOtp */
export async function requestClinicLoginOtp(contactNumber: string): Promise<OtpRequestResult> {
  return requestClinicOtp(contactNumber, OTP_PURPOSE_CLINIC_LOGIN);
}
