# Notificaciones — RK Inversiones

Correo vía **info@renace.tech** (Hostinger). WhatsApp automático cuando esté **Evolution API** en el VPS.

Todo se configura con **seed** — no editar `.env` a mano.

## SMTP (activo)

```bash
cd /opt/rk
echo 'TU_CLAVE_SMTP' > .smtp.local
chmod 600 .smtp.local
npm run seed
```

El seed genera `.env` con `SMTP_USER=info@renace.tech` y la clave desde `.smtp.local`.

## WhatsApp (Evolution API — próximo paso)

Cuando tengas la instancia Evolution:

```bash
cp evolution.local.example .evolution.local
# Editar URL, API key e instance
npm run seed && ./deploy.sh
```

Variables: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.

Mientras Evolution no esté lista, el landing usa enlaces `wa.me` para contacto manual. El servicio `notify` envía **solo correo**.

## Verificación

```bash
curl -s https://rk.renace.tech/api/notify/healthz
```

- `"smtp":true` — correo listo
- `"whatsapp":true` — Evolution conectada

## Seguridad

- Claves **nunca** en git
- `.smtp.local` y `.evolution.local` solo en el VPS
