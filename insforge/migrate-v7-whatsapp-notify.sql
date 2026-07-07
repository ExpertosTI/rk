-- Control de notificaciones WhatsApp
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS notificada_whatsapp_at timestamptz;

CREATE INDEX IF NOT EXISTS rk_solicitudes_notificada_wa_idx
  ON rk_solicitudes (notificada_whatsapp_at)
  WHERE notificada_whatsapp_at IS NOT NULL;
