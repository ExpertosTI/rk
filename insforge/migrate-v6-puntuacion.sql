-- Puntuación crediticia preliminar + cuota mensual declarada
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS cuota_mensual text;
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS puntuacion integer;
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS cuota_estimada numeric;
ALTER TABLE rk_solicitudes ADD COLUMN IF NOT EXISTS ratio_pago_pct integer;

CREATE INDEX IF NOT EXISTS rk_solicitudes_puntuacion_idx ON rk_solicitudes (puntuacion DESC);
