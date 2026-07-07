/**
 * Insforge client (PostgREST-compatible) — Renace stack
 * Patrón: ZAV / Moonshadows Sentinel
 */

const ENDPOINT = (
  import.meta.env.PUBLIC_INSFORGE_URL || 'https://insforge.renace.tech'
).replace(/\/$/, '');

const ANON_KEY =
  import.meta.env.PUBLIC_INSFORGE_ANON_KEY ||
  'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24ifQ.YTrshWNWGSWsmc6DUhitFQSXDICh9BTIiz4CK0GX0Cw';

const SERVICE_KEY =
  import.meta.env.PUBLIC_INSFORGE_SERVICE_KEY || ANON_KEY;

const MODE = import.meta.env.PUBLIC_INSFORGE_MODE || 'insforge';

export type InsforgeResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; detail?: string };

function isLegacyPostgrest() {
  return /\/rest\/v1$/i.test(ENDPOINT);
}

export function insforgeEnabled() {
  return Boolean(ENDPOINT && ANON_KEY);
}

function tablePath(table: string) {
  if (MODE === 'postgrest') return `/${table}`;
  if (isLegacyPostgrest()) return `/${table}`;
  return `/api/database/records/${table}`;
}

function buildUrl(table: string, qs = '') {
  const q = qs && !qs.startsWith('?') ? `?${qs}` : qs;
  return `${ENDPOINT}${tablePath(table)}${q}`;
}

function headers(key: 'anon' | 'service', prefer = 'return=representation') {
  const token = key === 'service' ? SERVICE_KEY : ANON_KEY;
  return {
    'Content-Type': 'application/json',
    apikey: ANON_KEY,
    Authorization: `Bearer ${token}`,
    Prefer: prefer,
    Accept: 'application/json',
  };
}

export async function probeInsforge(table = 'rk_solicitudes') {
  if (!insforgeEnabled()) {
    return { enabled: false, connected: false, endpoint: ENDPOINT, error: 'not_configured' };
  }
  try {
    const res = await fetch(buildUrl(table, 'limit=1'), {
      method: 'GET',
      headers: headers('anon', 'return=minimal'),
      cache: 'no-store',
    });
    const connected = res.ok || res.status === 404 || res.status === 406;
    return {
      enabled: true,
      connected,
      endpoint: ENDPOINT,
      error: res.ok ? undefined : `http_${res.status}`,
    };
  } catch (err) {
    return {
      enabled: true,
      connected: false,
      endpoint: ENDPOINT,
      error: err instanceof Error ? err.message : 'network',
    };
  }
}

export async function insforgeUpsert(
  table: string,
  row: Record<string, unknown>,
  onConflict = 'id',
  key: 'anon' | 'service' = 'anon',
): Promise<InsforgeResult> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(buildUrl(table, `on_conflict=${encodeURIComponent(onConflict)}`), {
      method: 'POST',
      headers: {
        ...headers(key),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([row]),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `http_${res.status}`, detail: text.slice(0, 300) };
    }
    const data = await res.json().catch(() => undefined);
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}

export async function insforgeQuery<T = Record<string, unknown>>(
  table: string,
  qs = 'order=created_at.desc',
  key: 'anon' | 'service' = 'service',
): Promise<InsforgeResult<T[]>> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(buildUrl(table, qs), {
      method: 'GET',
      headers: headers(key, 'return=representation'),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `http_${res.status}`, detail: text.slice(0, 300) };
    }
    const data = (await res.json()) as T[];
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}

export async function insforgePatch(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  key: 'anon' | 'service' = 'service',
): Promise<InsforgeResult> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(buildUrl(table, `id=eq.${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: headers(key),
      body: JSON.stringify(patch),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `http_${res.status}`, detail: text.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}

export async function insforgeInsert(
  table: string,
  row: Record<string, unknown> | Record<string, unknown>[],
  key: 'anon' | 'service' = 'anon',
): Promise<InsforgeResult> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await fetch(buildUrl(table), {
      method: 'POST',
      headers: headers(key),
      body: JSON.stringify(Array.isArray(row) ? row : [row]),
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { ok: false, error: `http_${res.status}`, detail: text.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network' };
  }
}
