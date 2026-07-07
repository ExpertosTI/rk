# RK Inversiones — Astro static → nginx (Renace Protocol)
FROM node:22-alpine AS build

WORKDIR /app

ARG PUBLIC_INSFORGE_URL=https://insforge.renace.tech
ARG PUBLIC_INSFORGE_MODE=insforge
ARG PUBLIC_INSFORGE_ANON_KEY=
ARG PUBLIC_INSFORGE_SERVICE_KEY=
ARG PUBLIC_ADMIN_PIN=RK2026
ARG PUBLIC_BUILD_ID=dev

ENV PUBLIC_INSFORGE_URL=$PUBLIC_INSFORGE_URL \
    PUBLIC_INSFORGE_MODE=$PUBLIC_INSFORGE_MODE \
    PUBLIC_INSFORGE_ANON_KEY=$PUBLIC_INSFORGE_ANON_KEY \
    PUBLIC_INSFORGE_SERVICE_KEY=$PUBLIC_INSFORGE_SERVICE_KEY \
    PUBLIC_ADMIN_PIN=$PUBLIC_ADMIN_PIN \
    PUBLIC_BUILD_ID=$PUBLIC_BUILD_ID

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

LABEL org.opencontainers.image.title="rk-web" \
      org.opencontainers.image.description="RK Inversiones — formulario de crédito" \
      org.opencontainers.image.url="https://rk.renace.tech" \
      org.opencontainers.image.vendor="renace.tech"

RUN rm -rf /etc/nginx/conf.d/default.conf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/rk.conf
COPY --from=build /app/dist /usr/share/nginx/html

RUN printf 'ok\n' > /usr/share/nginx/html/healthz

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

CMD ["nginx", "-g", "daemon off;"]
