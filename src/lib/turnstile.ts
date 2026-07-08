export const TURNSTILE_SITE_KEY = import.meta.env.PUBLIC_TURNSTILE_SITE_KEY || '';

export function turnstileEnabled() {
  return Boolean(TURNSTILE_SITE_KEY);
}

/** Verifica token Turnstile en el servidor (Cloudflare). */
export async function verifyTurnstile(token: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/notify/turnstile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
      cache: 'no-store',
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    return { ok: Boolean(data.ok), error: data.error };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
