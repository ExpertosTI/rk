-- Migración v2: cédula + autorizaciones (idempotente)
alter table rk_solicitudes add column if not exists autoriza_datos boolean default false;
alter table rk_solicitudes add column if not exists acepta_privacidad boolean default false;
alter table rk_solicitudes add column if not exists acepta_terminos boolean default false;
alter table rk_solicitudes add column if not exists cedula_recibida boolean default false;

create table if not exists rk_documentos (
  id text primary key,
  solicitud_id text not null,
  tipo text not null default 'cedula',
  nombre text,
  mime text,
  tamano integer,
  data_base64 text,
  created_at timestamptz not null default now()
);

create index if not exists rk_documentos_solicitud_idx on rk_documentos (solicitud_id);
