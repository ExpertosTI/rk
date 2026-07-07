# RK Inversiones — Formulario web

Stack: **Astro 7 + React 19 + nginx** · Deploy: **Renace (Docker Swarm + Traefik)**

## Desarrollo local

```bash
npm install
npm run seed     # genera .env y claves automáticamente
npm run dev      # http://localhost:4321
npm run build
```

## Producción (rk.renace.tech)

Un solo comando — seed, claves, tablas y deploy:

```bash
ssh root@45.9.191.18
cd /opt/rk && ./deploy.sh
```

## Admin

| URL | Acceso |
|-----|--------|
| `/admin` | PIN generado automáticamente en el primer deploy |

El PIN se guarda en el VPS: `/root/.rk-inversiones-credentials.txt`

Seguridad MVP: honeypot anti-spam, lockout 5 intentos en admin, headers nginx, `noindex` en `/admin`.

| Capa | Tecnología |
|------|------------|
| Framework | Astro 7 (SSG) |
| UI interactiva | React 19 |
| Formulario | React Hook Form + Zod |
| Iconos | Lucide React |
| Tipografía | Inter |
| Datos | Insforge (PostgreSQL Renace) |
| Servidor | nginx (Docker) |
| Hosting | Renace VPS + Traefik |
