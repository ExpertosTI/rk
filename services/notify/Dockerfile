FROM node:22-alpine
WORKDIR /app
COPY package.json index.mjs ./
RUN npm install --omit=dev
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8788/healthz || exit 1
CMD ["node", "index.mjs"]
