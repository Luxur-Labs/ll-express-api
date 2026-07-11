import { prisma } from '../utils/prisma';
import { revokeAllRefreshTokensForUser } from './refreshToken.service';

/** Bumps tokenVersion and revokes all refresh tokens — invalidates every client session. */
export async function invalidateUserSessions(userId: string): Promise<number> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  });
  await revokeAllRefreshTokensForUser(userId);
  return user.tokenVersion;
}
