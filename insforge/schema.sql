-- RK Inversiones · Insforge / PostgreSQL
-- Ejecutar en consola SQL de Insforge (https://insforge.renace.tech)
-- o con: ./scripts/apply-rk-schema.sh

create table if not exists rk_solicitudes (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  estado text not null default 'nueva',
  producto text,
  monto text,
  plazo text,
  garantia text,
  nombre text,
  whatsapp text,
  email text,
  ingresos text,
  provincia text,
  comentarios text,
  numero_cedula text,
  autoriza_datos boolean default false,
  acepta_privacidad boolean default false,
  acepta_terminos boolean default false,
  cedula_recibida boolean default false,
  paso_actual integer not null default 1,
  progreso_pct integer not null default 0,
  progreso_campos jsonb,
  completada boolean not null default false,
  notificada_email_at timestamptz,
  session_id text,
  origen text not null default 'web',
  user_agent text
);

create index if not exists rk_solicitudes_created_at_idx
  on rk_solicitudes (created_at desc);

create index if not exists rk_solicitudes_estado_idx
  on rk_solicitudes (estado);

create index if not exists rk_solicitudes_completada_idx
  on rk_solicitudes (completada);

create index if not exists rk_solicitudes_session_id_idx
  on rk_solicitudes (session_id);

create table if not exists rk_form_events (
  id text primary key,
  solicitud_id text,
  session_id text not null,
  evento text not null,
  paso integer,
  progreso_pct integer,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists rk_form_events_solicitud_idx
  on rk_form_events (solicitud_id);

create index if not exists rk_form_events_session_idx
  on rk_form_events (session_id);

create index if not exists rk_form_events_created_at_idx
  on rk_form_events (created_at desc);

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

create index if not exists rk_documentos_solicitud_idx
  on rk_documentos (solicitud_id);

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

-- Permisos: ver insforge/seed.sql (roles condicionales)
