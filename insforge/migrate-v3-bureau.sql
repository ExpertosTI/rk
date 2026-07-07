-- Migración v3: número de cédula + consultas buró
alter table rk_solicitudes add column if not exists numero_cedula text;

create table if not exists rk_bureau_consultas (
  id text primary key,
  solicitud_id text not null,
  numero_cedula text not null,
  proveedor text not null default 'transunion',
  estado text not null default 'pendiente',
  score integer,
  resumen text,
  recomendacion text,
  payload jsonb,
  error_msg text,
  created_at timestamptz not null default now()
);

create index if not exists rk_bureau_solicitud_idx on rk_bureau_consultas (solicitud_id);
create index if not exists rk_bureau_created_idx on rk_bureau_consultas (created_at desc);
