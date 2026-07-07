/** Notificación al recibir solicitud nueva (correo + WhatsApp al equipo). */
export async function notifyNuevaSolicitud(solicitudId: string): Promise<void> {
  try {
    await fetch('/api/notify/solicitud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId }),
      keepalive: true,
    });
  } catch {
    /* no bloquear al usuario si falla */
  }
}

/** Notificación al solicitante cuando se aprueba o rechaza. */
export async function notifyEstadoSolicitud(
  solicitudId: string,
  estado: 'aprobada' | 'rechazada',
): Promise<{ ok: boolean; error?: string; email?: boolean; whatsapp?: boolean }> {
  try {
    const res = await fetch('/api/notify/estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId, estado }),
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
