-- RK Inversiones · datos iniciales / permisos extra
-- Idempotente — seguro ejecutar varias veces

-- Asegurar permisos en tablas (por si el rol difiere)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT SELECT, INSERT, UPDATE ON rk_solicitudes TO anon;
    GRANT SELECT, INSERT ON rk_form_events TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT ALL ON rk_solicitudes TO service_role;
    GRANT ALL ON rk_form_events TO service_role;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT, INSERT, UPDATE ON rk_solicitudes TO authenticated;
    GRANT SELECT, INSERT ON rk_form_events TO authenticated;
  END IF;
END $$;

-- Refrescar cache de esquema PostgREST (si existe la función)
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
