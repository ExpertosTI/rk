/** Dispara notificación por correo (fire-and-forget tras envío exitoso). */
export async function notifyNuevaSolicitud(solicitudId: string): Promise<void> {
  try {
    await fetch('/api/notify/solicitud', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solicitudId }),
      keepalive: true,
    });
  } catch {
    /* no bloquear al usuario si el correo falla */
  }
}
