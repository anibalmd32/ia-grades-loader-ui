# Versión web de Notas para producción: build con Bun y estáticos servidos por nginx.
# La URL de la API se configura al arrancar el contenedor (API_URL), no al compilar.

FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock ./
# --ignore-scripts: no instala los hooks de lefthook dentro de la imagen
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
RUN bun run build

FROM nginx:stable-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/40-app-config.sh /docker-entrypoint.d/40-app-config.sh
RUN chmod +x /docker-entrypoint.d/40-app-config.sh
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
