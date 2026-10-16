#!/bin/sh
# Genera /config.js con la URL de la API al arrancar el contenedor.
set -eu

if [ -z "${API_URL:-}" ]; then
  echo "ERROR: falta la variable API_URL (p. ej. https://api.ejemplo.com/api/v1)" >&2
  exit 1
fi

cat > /usr/share/nginx/html/config.js <<CONFIG
window.__APP_CONFIG__ = { API_URL: "${API_URL}" };
CONFIG
echo "config.js: API_URL=${API_URL}"
