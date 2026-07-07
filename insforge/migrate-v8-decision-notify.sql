-- Notificaciones al aprobar o rechazar solicitud
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS notificada_aprobada_at timestamptz;
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS notificada_rechazada_at timestamptz;
