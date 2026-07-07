import type { ProductKey } from './constants';
import type { CreditFormData } from './schema';
import type { GARANTIA_LABELS } from './constants';
import {
  insforgeInsert,
  insforgePatch,
  insforgeQuery,
  insforgeUpsert,
  insforgeDelete,
  probeInsforge,
} from './insforge';
import { notifyNuevaSolicitud } from './notify';

export type SolicitudEstado = 'nueva' | 'revision' | 'aprobada' | 'rechazada' | 'cerrada' | 'borrador';

export interface SolicitudRow {
  id: string;
  created_at: string;
  updated_at: string;
  estado: SolicitudEstado;
  producto: ProductKey | null;
  monto: string | null;
  plazo: string | null;
  garantia: keyof typeof GARANTIA_LABELS | null;
  nombre: string | null;
  whatsapp: string | null;
  email: string | null;
  ingresos: string | null;
  provincia: string | null;
  comentarios: string | null;
  numero_cedula?: string | null;
  autoriza_datos?: boolean;
  acepta_privacidad?: boolean;
  acepta_terminos?: boolean;
  cedula_recibida?: boolean;
  paso_actual: number;
  progreso_pct: number;
  progreso_campos: Record<string, boolean> | null;
  completada: boolean;
  notificada_email_at?: string | null;
  session_id: string | null;
  origen: string;
  user_agent?: string | null;
}

export interface DocumentoRow {
  id: string;
  solicitud_id: string;
  tipo: string;
  nombre: string | null;
  mime: string | null;
  tamano: number | null;
  data_base64: string | null;
  created_at: string;
}

export interface Solicitud extends Omit<SolicitudRow, 'created_at' | 'updated_at'> {
  fecha: string;
}

const SESSION_KEY = 'rk_session';
const SOLICITUD_KEY = 'rk_solicitud_id';
const LOCAL_KEY = 'rk_solicitudes';

function nowIso() {
  return new Date().toISOString();
}

export function getSessionId(): string {
  if (typeof sessionStorage === 'undefined') return 'ssr';
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function getSolicitudId(): string {
  if (typeof sessionStorage === 'undefined') return `RK-${Date.now().toString(36).toUpperCase()}`;
  let id = sessionStorage.getItem(SOLICITUD_KEY);
  if (!id) {
    id = `RK-${Date.now().toString(36).toUpperCase()}`;
    sessionStorage.setItem(SOLICITUD_KEY, id);
  }
  return id;
}

export function resetSolicitudSession() {
  sessionStorage.removeItem(SOLICITUD_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}

function rowToSolicitud(row: SolicitudRow): Solicitud {
  return {
    ...row,
    fecha: row.created_at,
    producto: row.producto,
    garantia: row.garantia,
    estado: row.estado,
  };
}

function formToRow(
  id: string,
  sessionId: string,
  data: Partial<CreditFormData>,
  opts: {
    paso: number;
    progresoPct: number;
    progresoCampos: Record<string, boolean>;
    completada: boolean;
    estado: SolicitudEstado;
  },
): Record<string, unknown> {
  const ts = nowIso();
  return {
    id,
    updated_at: ts,
    estado: opts.estado,
    producto: data.producto ?? null,
    monto: data.monto || null,
    plazo: data.plazo || null,
    garantia: data.garantia ?? null,
    nombre: data.nombre || null,
    whatsapp: data.whatsapp || null,
    email: data.email || null,
    ingresos: data.ingresos || null,
    provincia: data.provincia || null,
    comentarios: data.comentarios || null,
    numero_cedula: data.numeroCedula ? data.numeroCedula.replace(/\D/g, '') : null,
    autoriza_datos: data.autorizaDatos ?? false,
    acepta_privacidad: data.aceptaPrivacidad ?? false,
    acepta_terminos: data.aceptaTerminos ?? false,
    cedula_recibida: Boolean(data.cedulaData && data.cedulaData.length > 80),
    paso_actual: opts.paso,
    progreso_pct: opts.progresoPct,
    progreso_campos: opts.progresoCampos,
    completada: opts.completada,
    session_id: sessionId,
    origen: 'web',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : null,
  };
}

function saveLocal(solicitud: Solicitud) {
  const stored = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as Solicitud[];
  const idx = stored.findIndex((s) => s.id === solicitud.id);
  if (idx >= 0) stored[idx] = solicitud;
  else stored.unshift(solicitud);
  localStorage.setItem(LOCAL_KEY, JSON.stringify(stored));
}

export async function logFormEvent(
  evento: string,
  opts: {
    solicitudId?: string;
    paso?: number;
    progresoPct?: number;
    payload?: Record<string, unknown>;
  },
) {
  const sessionId = getSessionId();
  const id = `EVT-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
  await insforgeInsert('rk_form_events', {
    id,
    solicitud_id: opts.solicitudId ?? getSolicitudId(),
    session_id: sessionId,
    evento,
    paso: opts.paso ?? null,
    progreso_pct: opts.progresoPct ?? null,
    payload: opts.payload ?? null,
    created_at: nowIso(),
  });
}

export async function saveDraft(
  data: Partial<CreditFormData>,
  paso: number,
  progresoPct: number,
  progresoCampos: Record<string, boolean>,
) {
  const id = getSolicitudId();
  const sessionId = getSessionId();
  const row = formToRow(id, sessionId, data, {
    paso,
    progresoPct,
    progresoCampos,
    completada: false,
    estado: 'borrador',
  });

  const result = await insforgeUpsert('rk_solicitudes', row);
  if (!result.ok) {
    console.warn('[RK] draft sync failed:', result.error, result.detail);
  }
  return result;
}

export async function saveCedulaDocument(
  solicitudId: string,
  data: Pick<CreditFormData, 'cedulaData' | 'cedulaNombre' | 'cedulaMime'>,
) {
  const id = `DOC-${solicitudId}`;
  const tamano = Math.ceil((data.cedulaData.length * 3) / 4);
  return insforgeUpsert(
    'rk_documentos',
    {
      id,
      solicitud_id: solicitudId,
      tipo: 'cedula',
      nombre: data.cedulaNombre,
      mime: data.cedulaMime,
      tamano,
      data_base64: data.cedulaData,
      created_at: nowIso(),
    },
    'id',
  );
}

export async function fetchDocumentoCedula(solicitudId: string) {
  return insforgeQuery<DocumentoRow>(
    'rk_documentos',
    `solicitud_id=eq.${encodeURIComponent(solicitudId)}&tipo=eq.cedula&limit=1`,
    'anon',
  );
}

export async function submitSolicitud(data: CreditFormData, progresoPct: number) {
  const id = getSolicitudId();
  const sessionId = getSessionId();
  const ts = nowIso();

  const row = {
    ...formToRow(id, sessionId, data, {
      paso: 3,
      progresoPct: 100,
      progresoCampos: {},
      completada: true,
      estado: 'nueva',
    }),
    updated_at: ts,
    progreso_pct: 100,
  };

  const result = await insforgeUpsert('rk_solicitudes', row);

  if (result.ok && data.cedulaData) {
    await saveCedulaDocument(id, data);
  }

  const solicitud: Solicitud = rowToSolicitud(row as unknown as SolicitudRow);

  if (result.ok) {
    await logFormEvent('submit', {
      solicitudId: id,
      paso: 3,
      progresoPct: 100,
      payload: { producto: data.producto, monto: data.monto },
    });
    void notifyNuevaSolicitud(id);
  } else {
    console.warn('[RK] submit sync failed, saving locally:', result.error);
    saveLocal(solicitud);
  }

  return { solicitud, syncOk: result.ok };
}

export async function fetchSolicitudes(): Promise<{ items: Solicitud[]; source: 'insforge' | 'local'; error?: string }> {
  const remote = await insforgeQuery<SolicitudRow>(
    'rk_solicitudes',
    'completada=eq.true&order=created_at.desc',
    'anon',
  );

  if (remote.ok && remote.data) {
    return {
      items: remote.data.map(rowToSolicitud),
      source: 'insforge',
    };
  }

  const local = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]') as Solicitud[];
  return {
    items: local.filter((s) => s.estado !== 'borrador'),
    source: 'local',
    error: remote.error,
  };
}

export async function fetchAllSolicitudesAdmin(): Promise<{
  items: Solicitud[];
  drafts: Solicitud[];
  error?: string;
}> {
  const remote = await insforgeQuery<SolicitudRow>(
    'rk_solicitudes',
    'order=created_at.desc&limit=500',
    'anon',
  );

  if (remote.ok && remote.data) {
    const all = remote.data.map(rowToSolicitud);
    return {
      items: all.filter((s) => s.completada),
      drafts: all.filter((s) => !s.completada),
    };
  }

  return {
    items: [],
    drafts: [],
    error: remote.error ?? 'sync_failed',
  };
}

export async function updateSolicitudEstado(id: string, estado: SolicitudEstado) {
  const patch = { estado, updated_at: nowIso() };
  return insforgePatch('rk_solicitudes', id, patch, 'anon');
}

export async function deleteSolicitud(id: string) {
  const enc = encodeURIComponent(id);
  const tables = [
    `rk_form_events?solicitud_id=eq.${enc}`,
    `rk_documentos?solicitud_id=eq.${enc}`,
    `rk_bureau_consultas?solicitud_id=eq.${enc}`,
  ];
  for (const filter of tables) {
    const table = filter.split('?')[0];
    const qs = filter.split('?')[1];
    const res = await insforgeDelete(table, qs);
    if (!res.ok) return res;
  }
  return insforgeDelete('rk_solicitudes', `id=eq.${enc}`);
}

export async function checkInsforgeConnection() {
  return probeInsforge('rk_solicitudes');
}
