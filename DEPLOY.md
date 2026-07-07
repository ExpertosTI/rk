# Despliegue principal — RK Inversiones

**Producción:** https://rk.renace.tech  
**Repo:** https://github.com/ExpertosTI/rk  
**VPS Renace:** `root@45.9.191.18` → `/opt/rk`

---

## Primera puesta en producción (una sola vez)

Conéctate al VPS y ejecuta:

```bash
ssh root@45.9.191.18

git clone https://github.com/ExpertosTI/rk.git /opt/rk
cd /opt/rk
chmod +x deploy.sh
./deploy.sh
```

Eso hace:
1. Build de la imagen `rk-web:latest` (Astro → nginx)
2. Deploy del stack `rk` en Docker Swarm
3. Registro en Traefik con TLS Let's Encrypt
4. Verificación de `https://rk.renace.tech/healthz`

---

## Redespliegues posteriores

```bash
ssh root@45.9.191.18
cd /opt/rk && ./deploy.sh
```

---

## Verificar producción

```bash
curl -fsS https://rk.renace.tech/healthz   # debe responder: ok
curl -fsS -o /dev/null -w "%{http_code}" https://rk.renace.tech/   # 200
docker service ls | grep rk
docker service logs rk_web --tail 50
```

---

## Stack

| Componente | Tecnología |
|------------|------------|
| App | Astro 7 + React 19 |
| Servidor | nginx (contenedor) |
| Orquestación | Docker Swarm |
| Proxy / SSL | Traefik + Let's Encrypt |
| Red | RenaceNet |

---

## DNS

`rk.renace.tech` debe apuntar al VPS `45.9.191.18` (o wildcard `*.renace.tech` si ya está configurado en Renace).
