import bcrypt from 'bcryptjs';

import { env } from '../config/env';

export async function hashPassword(plain: string) {
  const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
  return bcrypt.hash(plain, salt);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}


