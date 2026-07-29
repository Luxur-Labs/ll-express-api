import { Request, Response } from 'express';

import {
  clinicPortalAccountStatus,
  getGenericOtpMessage,
  loginClinicWithPassword,
  OTP_PURPOSE_CLINIC_LOGIN,
  OTP_PURPOSE_CLINIC_PASSWORD_RESET,
  requestClinicOtp,
  resetClinicPassword,
  setClinicPortalPassword,
  verifyClinicLoginOtp,
} from '../services/clinicOtp.service';
import { createRefreshToken } from '../services/refreshToken.service';
import { signToken } from '../services/auth.service';
import { getClientIp } from '../services/security.service';
import { EmployeeType, TechnicianGroup, Role as AuthRole, AuthUser } from '../types/auth';
import { prisma } from '../utils/prisma';

type UserWithRelations = NonNullable<Awaited<ReturnType<typeof loadUserForAuth>>>;

async function loadUserForAuth(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: { employeeType: true, technicianGroup: true, clinic: true },
  });
}

function formatAuthUser(user: UserWithRelations, clinic?: { id: string; clinicName: string }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    employeeType: user.employeeType?.name ?? null,
    technicianGroup: user.technicianGroup?.name ?? null,
    lastLoginAt: user.lastLoginAt,
    mustChangePassword: user.mustChangePassword === true,
    name: user.name ?? clinic?.clinicName ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    contact: user.contact ?? null,
    profilePhoto: user.profilePhoto ?? null,
    clinicId: user.clinicId ?? clinic?.id ?? null,
    clinicName: user.clinic?.clinicName ?? clinic?.clinicName ?? null,
  };
}

function signAccessToken(user: UserWithRelations) {
  return signToken({
    id: user.id,
    email: user.email,
    role: user.role as unknown as AuthRole,
    employeeType: (user.employeeType?.name as EmployeeType | undefined) ?? null,
    technicianGroup: (user.technicianGroup?.name as TechnicianGroup | undefined) ?? null,
    mustChangePassword: user.mustChangePassword === true,
    tokenVersion: user.tokenVersion,
    clinicId: user.clinicId ?? undefined,
  });
}

async function issueAuthTokens(user: UserWithRelations, req: Request, clinic?: { id: string; clinicName: string }) {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken({
    userId: user.id,
    ipAddress: getClientIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
    user: formatAuthUser(user, clinic),
  };
}

async function completeClinicLogin(userId: string, req: Request, clinic: { id: string; clinicName: string }) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: getClientIp(req),
    },
  });

  const fullUser = await loadUserForAuth(userId);
  if (!fullUser) {
    throw new Error('Login failed');
  }

  return issueAuthTokens(fullUser, req, clinic);
}

export async function clinicAccountStatusController(req: Request, res: Response) {
  try {
    const contactNumber = String(req.query.contactNumber ?? '');
    const status = await clinicPortalAccountStatus(contactNumber);
    return res.json(status);
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Could not check account' });
  }
}

export async function clinicRequestOtpController(req: Request, res: Response) {
  try {
    const { contactNumber, purpose } = req.body as { contactNumber: string; purpose?: 'login' | 'reset' };
    const otpPurpose = purpose === 'reset' ? OTP_PURPOSE_CLINIC_PASSWORD_RESET : OTP_PURPOSE_CLINIC_LOGIN;
    const result = await requestClinicOtp(contactNumber, otpPurpose);
    return res.json({
      message: getGenericOtpMessage(),
      sendsUsed: result.sendsUsed,
      resendsRemaining: result.resendsRemaining,
      cooldownSeconds: result.cooldownSeconds,
    });
  } catch (e: any) {
    const message = e?.message || 'Could not send login code';
    if (String(message).includes('wait') && String(message).includes('seconds')) {
      return res.status(429).json({ message });
    }
    if (String(message).includes('Maximum resend limit')) {
      return res.status(429).json({ message });
    }
    return res.status(400).json({ message });
  }
}

export async function clinicVerifyOtpController(req: Request, res: Response) {
  try {
    const { contactNumber, code } = req.body as { contactNumber: string; code: string };
    const { user, clinic } = await verifyClinicLoginOtp(contactNumber, code);
    const tokens = await completeClinicLogin(user.id, req, {
      id: clinic.id,
      clinicName: clinic.clinicName,
    });
    return res.json(tokens);
  } catch (e: any) {
    const message = e?.message || 'Verification failed';
    return res.status(401).json({ message });
  }
}

export async function clinicPasswordLoginController(req: Request, res: Response) {
  try {
    const { contactNumber, password } = req.body as { contactNumber: string; password: string };
    const { user, clinic } = await loginClinicWithPassword(contactNumber, password);
    const tokens = await completeClinicLogin(user.id, req, {
      id: clinic.id,
      clinicName: clinic.clinicName,
    });
    return res.json(tokens);
  } catch (e: any) {
    return res.status(401).json({ message: e?.message || 'Login failed' });
  }
}

export async function clinicSetPasswordController(req: Request, res: Response) {
  try {
    const authUser = res.locals.user as AuthUser | undefined;
    if (!authUser || authUser.role !== 'CLINIC') {
      return res.status(403).json({ message: 'Clinic access only' });
    }

    const fullUser = await loadUserForAuth(authUser.id);
    if (!fullUser?.mustChangePassword) {
      return res.status(400).json({ message: 'Password is already set' });
    }

    const { newPassword } = req.body as { newPassword: string };
    await setClinicPortalPassword(authUser.id, newPassword);

    const updated = await loadUserForAuth(authUser.id);
    if (!updated) {
      return res.status(500).json({ message: 'Could not update password' });
    }

    const tokens = await issueAuthTokens(updated, req, {
      id: updated.clinicId!,
      clinicName: updated.clinic?.clinicName ?? updated.name ?? 'Clinic',
    });
    return res.json({
      ...tokens,
      message: 'Password set successfully',
    });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Could not set password' });
  }
}

export async function clinicResetPasswordController(req: Request, res: Response) {
  try {
    const { contactNumber, code, currentPassword, newPassword } = req.body as {
      contactNumber: string;
      code: string;
      currentPassword: string;
      newPassword: string;
    };
    await resetClinicPassword(contactNumber, code, currentPassword, newPassword);
    return res.json({ message: 'Password updated successfully. Sign in with your new password.' });
  } catch (e: any) {
    return res.status(400).json({ message: e?.message || 'Password reset failed' });
  }
}
