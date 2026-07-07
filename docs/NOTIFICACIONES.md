# Notificaciones por correo — RK Inversiones

## Remitente
`info@renace.tech` vía SMTP Hostinger (`smtp.hostinger.com:465`).

## Destinatarios
- **Equipo RK:** alerta por cada solicitud nueva completada
- **Solicitante:** confirmación automática si dejó correo en el formulario

## Configuración en VPS

1. Crear `/opt/rk/.smtp.local` con la clave del buzón Hostinger (una línea, sin espacios extra).
2. Ejecutar `./deploy.sh` — el seed lee `.smtp.local` y guarda todo en `/root/.rk-inversiones-credentials.txt`.
3. En despliegues siguientes, si falta `.smtp.local`, se restaura desde el archivo de credenciales.

## Seguridad
- Clave SMTP **nunca** en git ni en variables `PUBLIC_*`
- Servicio `notify` valida la solicitud en Insforge antes de enviar
- Límite de peticiones por IP
- Campo `notificada_email_at` evita correos duplicados

## Verificación
```bash
curl -s https://rk.renace.tech/api/notify/healthz
```
Debe responder `smtp: true` cuando la clave está configurada.
