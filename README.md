# RK Inversiones — Formulario web

Stack: **Astro 7 + React 19 + nginx** · Deploy: **Renace (Docker Swarm + Traefik)**

## Desarrollo local

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
```

## Producción (rk.renace.tech)

```bash
ssh root@45.9.191.18
cd /opt/rk && ./deploy.sh
```

## Admin

| URL | Clave por defecto |
|-----|-------------------|
| `/admin` | `RK2026` (cambiar con `PUBLIC_ADMIN_PIN` en build) |

Seguridad MVP: honeypot anti-spam, lockout 5 intentos en admin, headers nginx, `noindex` en `/admin`.

| Capa | Tecnología |
|------|------------|
| Framework | Astro 7 (SSG) |
| UI interactiva | React 19 |
| Formulario | React Hook Form + Zod |
| Iconos | Lucide React |
| Tipografía | Plus Jakarta Sans |
| Servidor | nginx (Docker) |
| Hosting | Renace VPS + Traefik |
