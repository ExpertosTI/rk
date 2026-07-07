import { ADMIN } from './constants';
import { cedulaDigits } from './formatters';

export interface BureauConsulta {
  id: string;
  solicitud_id: string;
  numero_cedula: string;
  proveedor: string;
  estado: string;
  score: number | null;
  resumen: string | null;
  recomendacion: string | null;
  error_msg?: string | null;
  created_at: string;
}

const BUREAU_API = '/api/bureau';

export async function consultarBuro(opts: {
  solicitudId: string;
  numeroCedula: string;
  nombre: string;
}) {
  const res = await fetch(`${BUREAU_API}/consultar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      adminPin: ADMIN.pin,
      solicitudId: opts.solicitudId,
      numeroCedula: cedulaDigits(opts.numeroCedula),
      nombre: opts.nombre,
    }),
    cache: 'no-store',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false as const,
      error: data.error ?? `http_${res.status}`,
      consulta: data.consulta as BureauConsulta | undefined,
    };
  }

  return { ok: true as const, consulta: data.consulta as BureauConsulta, mode: data.mode as string };
}

export async function fetchConsultasBuro(solicitudId: string) {
  const { insforgeQuery } = await import('./insforge');
  return insforgeQuery<BureauConsulta>(
    'rk_bureau_consultas',
    `solicitud_id=eq.${encodeURIComponent(solicitudId)}&order=created_at.desc`,
    'anon',
  );
}
