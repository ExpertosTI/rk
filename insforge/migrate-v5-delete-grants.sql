-- Permisos DELETE para panel admin (borrar solicitudes)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    GRANT DELETE ON rk_solicitudes TO anon;
    GRANT DELETE ON rk_form_events TO anon;
    GRANT DELETE ON rk_documentos TO anon;
    GRANT DELETE ON rk_bureau_consultas TO anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT DELETE ON rk_solicitudes TO service_role;
    GRANT DELETE ON rk_form_events TO service_role;
    GRANT DELETE ON rk_documentos TO service_role;
    GRANT DELETE ON rk_bureau_consultas TO service_role;
  END IF;
END $$;
