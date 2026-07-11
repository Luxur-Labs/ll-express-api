import crypto from 'crypto';

import { env } from '../config/env';
import { prisma } from '../utils/prisma';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export async function createRefreshToken(params: {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<string> {
  const plain = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_DAYS);

  await prisma.refreshToken.create({
    data: {
      userId: params.userId,
      tokenHash: hashToken(plain),
      expiresAt,
      userAgent: params.userAgent,
      ipAddress: params.ipAddress,
    },
  });

  return plain;
}

export async function rotateRefreshToken(
  plainToken: string,
  meta?: { userAgent?: string; ipAddress?: string }
): Promise<{ userId: string; newRefreshToken: string } | null> {
  const hash = hashToken(plainToken);
  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash },
  });

  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    if (existing && !existing.revokedAt) {
      await revokeAllRefreshTokensForUser(existing.userId);
    }
    return null;
  }

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  const newPlain = await createRefreshToken({
    userId: existing.userId,
    userAgent: meta?.userAgent,
    ipAddress: meta?.ipAddress,
  });

  return { userId: existing.userId, newRefreshToken: newPlain };
}

export async function revokeRefreshToken(plainToken: string): Promise<void> {
  const hash = hashToken(plainToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllRefreshTokensForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
