-- Migración v4: control de notificaciones por correo
alter table rk_solicitudes add column if not exists notificada_email_at timestamptz;

create index if not exists rk_solicitudes_notificada_idx
  on rk_solicitudes (notificada_email_at)
  where notificada_email_at is not null;
