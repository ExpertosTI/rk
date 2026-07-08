const NOTIFY_SECRET = import.meta.env.PUBLIC_NOTIFY_SECRET || '';

function notifyPayload(data: Record<string, unknown>) {
  return NOTIFY_SECRET ? { ...data, secret: NOTIFY_SECRET } : data;
}

/** Notificación al recibir solicitud nueva (correo + WhatsApp al equipo). */
export async function notifyNuevaSolicitud(solicitudId: string): Promise<void> {
  try {
    await fetch('/api/notify/solicitud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifyPayload({ solicitudId })),
      keepalive: true,
    });
  } catch {
    /* no bloquear al usuario si falla */
  }
}

/** Notificación al solicitante cuando cambia el estado (correo; WhatsApp si aplica). */
export type EstadoNotificable = 'revision' | 'aprobada' | 'rechazada' | 'cerrada';

export async function notifyEstadoSolicitud(
  solicitudId: string,
  estado: EstadoNotificable,
): Promise<{ ok: boolean; error?: string; email?: boolean; whatsapp?: boolean; skipped?: boolean }> {
  try {
    const res = await fetch('/api/notify/estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notifyPayload({ solicitudId, estado })),
      keepalive: true,
    });
    const data = (await res.json()) as {
      ok?: boolean;
      error?: string;
      email?: boolean;
      whatsapp?: boolean;
    };
    return {
      ok: Boolean(data.ok),
      error: data.error,
      email: data.email,
      whatsapp: data.whatsapp,
    };
  } catch {
    return { ok: false, error: 'network_error' };
  }
}
