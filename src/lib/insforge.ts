/**
 * Insforge client (PostgREST-compatible) — Renace stack
 */

/** Clave anon del stack Renace — única válida en PostgREST local */
export const RENACE_ANON_KEY =
  'eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogImFub24ifQ.YTrshWNWGSWsmc6DUhitFQSXDICh9BTIiz4CK0GX0Cw';

const ENDPOINT = (
  import.meta.env.PUBLIC_INSFORGE_URL || 'https://insforge.renace.tech'
).replace(/\/$/, '');

const MODE = import.meta.env.PUBLIC_INSFORGE_MODE || 'insforge';

/** /api/insforge en el mismo dominio → proxy nginx → PostgREST Renace */
const LOCAL_POSTGREST = MODE === 'postgrest' && ENDPOINT.startsWith('/api/');

export type InsforgeResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string; detail?: string };

function isLegacyPostgrest() {
  return /\/rest\/v1$/i.test(ENDPOINT);
}

export function insforgeEnabled() {
  return Boolean(ENDPOINT);
}

function tablePath(table: string) {
  if (LOCAL_POSTGREST) return `/${table}`;
  if (isLegacyPostgrest()) return `/${table}`;
  return `/api/database/records/${table}`;
}

function buildUrl(table: string, qs = '') {
  const q = qs && !qs.startsWith('?') ? `?${qs}` : qs;
  return `${ENDPOINT}${tablePath(table)}${q}`;
}

function headers(prefer = 'return=representation') {
  const base: Record<string, string> = {
    'Content-Type': 'application/json',
    Prefer: prefer,
    Accept: 'application/json',
  };
  // PostgREST Renace vía /api/insforge: sin JWT (enviar uno inválido → 401)
  if (LOCAL_POSTGREST) return base;
  const anon = import.meta.env.PUBLIC_INSFORGE_ANON_KEY || RENACE_ANON_KEY;
  return {
    ...base,
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

async function insforgeFetch(url: string, init?: RequestInit, timeoutMs = 20_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeInsforge(table = 'rk_solicitudes') {
  if (!insforgeEnabled()) {
    return { enabled: false, connected: false, endpoint: ENDPOINT, error: 'not_configured' };
  }
  try {
    const res = await insforgeFetch(buildUrl(table, 'limit=1'), {
      method: 'GET',
      headers: headers('return=minimal'),
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
  _key?: 'anon' | 'service',
): Promise<InsforgeResult> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await insforgeFetch(buildUrl(table, `on_conflict=${encodeURIComponent(onConflict)}`), {
      method: 'POST',
      headers: {
        ...headers(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify([row]),
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
  _key?: 'anon' | 'service',
): Promise<InsforgeResult<T[]>> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await insforgeFetch(buildUrl(table, qs), {
      method: 'GET',
      headers: headers('return=representation'),
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
  _key?: 'anon' | 'service',
): Promise<InsforgeResult> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await insforgeFetch(buildUrl(table, `id=eq.${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify(patch),
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
  _key?: 'anon' | 'service',
): Promise<InsforgeResult> {
  if (!insforgeEnabled()) return { ok: false, error: 'not_configured' };
  try {
    const res = await insforgeFetch(buildUrl(table), {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(Array.isArray(row) ? row : [row]),
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
