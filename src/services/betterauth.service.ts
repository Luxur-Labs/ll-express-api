import { env } from '../config/env';

export async function betterAuthForgotPassword(email: string) {
  if (!env.BETTERAUTH_BASE_URL || !env.BETTERAUTH_API_TOKEN) return;
  const url = new URL(env.BETTERAUTH_FORGOT_PATH, env.BETTERAUTH_BASE_URL).toString();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.BETTERAUTH_API_TOKEN}` },
    body: JSON.stringify({ email }),
  });
  // Consider 2xx as success; swallow errors to avoid user enumeration
  if (!res.ok) {
    // Optionally log/res.text, but do not throw to keep UX consistent
    return;
  }
}
