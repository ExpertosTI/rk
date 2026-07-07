# DATACRÉDITO / TransUnion — Integración RK Inversiones

RK Inversiones consulta el buró de crédito a través de **TransUnion República Dominicana**, operador de **DATACRÉDITO** en RD.

## Suscripción empresarial (requerida para producción)

1. Contratar el servicio **ICS** (Information Credit System) con TransUnion:
   - [Suscripciones TransUnion RD](https://www.transunion.com.do/ICS/pages/subscriptions.xhtml)
2. TransUnion entregará credenciales B2B, típicamente:
   - `client_id` / `client_secret` (OAuth 2.0 client credentials)
   - `subscriber_code` (código de suscriptor)
   - URLs de token y API (entorno sandbox y producción)
3. El solicitante debe marcar **autorización de verificación de datos** en el formulario (incluye DATACRÉDITO).

## Arquitectura en RK

```
Admin (/admin)  →  POST /api/bureau/consultar  →  servicio bureau (Docker)
                                                      ↓
                                              PostgREST / Insforge
                                              rk_bureau_consultas
```

- El frontend **nunca** llama a TransUnion directamente.
- El microservicio `services/bureau` valida el PIN de administrador y guarda cada consulta en Insforge.
- Hasta activar el contrato, el sistema opera en modo **`mock`** (consulta simulada con score de prueba).

## Variables de entorno

Añadir en `.env` del VPS (o conservar tras `npm run seed`):

| Variable | Descripción |
|----------|-------------|
| `TRANSUNION_MODE` | `mock` (default) o `live` |
| `TRANSUNION_CLIENT_ID` | OAuth client ID |
| `TRANSUNION_CLIENT_SECRET` | OAuth client secret |
| `TRANSUNION_TOKEN_URL` | URL token OAuth |
| `TRANSUNION_API_URL` | Base URL API consulta |
| `TRANSUNION_SUBSCRIBER_CODE` | Código de suscriptor ICS |

`PUBLIC_ADMIN_PIN` / `BUREAU_ADMIN_PIN` protegen el endpoint de consulta.

## Activar modo live

```bash
# En /opt/rk/.env
TRANSUNION_MODE=live
TRANSUNION_CLIENT_ID=...
TRANSUNION_CLIENT_SECRET=...
TRANSUNION_TOKEN_URL=...
TRANSUNION_API_URL=...
TRANSUNION_SUBSCRIBER_CODE=...

cd /opt/rk && ./deploy.sh
```

## Uso en el panel admin

1. Entrar a `https://rk.renace.tech/admin` con el PIN generado en deploy.
2. Abrir una solicitud **completada** con autorización de datos.
3. Verificar que tenga **número de cédula** (11 dígitos).
4. Pulsar **Consultar buró**.
5. El historial queda en `rk_bureau_consultas` (score, resumen, recomendación).

## Formulario público

El paso 2 del formulario solicita:

- Número de cédula (11 dígitos)
- Foto/PDF de la cédula
- Autorización expresa para consulta en DATACRÉDITO

## Troubleshooting seed en VPS

Si `seed-db` falla con `role "root" does not exist`:

```bash
./scripts/seed-db.sh discover
POSTGRES_USER=postgres POSTGRES_DB=insforge ./scripts/seed-db.sh
```

## Nota legal

La consulta al buró requiere consentimiento del titular y contrato vigente con TransUnion. RK Inversiones es responsable del uso conforme a la Ley 172-13 y normativa de la SIB.
