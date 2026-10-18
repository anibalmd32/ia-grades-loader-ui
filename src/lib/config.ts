declare global {
  interface Window {
    __APP_CONFIG__?: { API_URL?: string };
  }
}

// URL base de la API (incluye /api/v1). En Docker se configura al arrancar el
// contenedor (public/config.js); si no, se usa VITE_API_URL del build (ver .env.example).
// En las apps nativas viene del secreto VITE_API_URL_PROD del release.
export const API_URL: string =
  (typeof window !== "undefined" && window.__APP_CONFIG__?.API_URL) ||
  import.meta.env.VITE_API_URL ||
  "";

/** false = el build no tiene URL de la API: la app muestra un aviso en vez de quedarse en blanco */
export const API_CONFIGURED = API_URL !== "";

// Las rutas del OpenAPI ya incluyen /api/v1, así que el cliente usa la URL sin ese sufijo
export const API_BASE_URL = API_URL.replace(/\/api\/v1\/?$/, "");

/** Página de descargas: instalador de Windows y APK de Android de la última versión */
export const RELEASES_URL = "https://github.com/anibalmd32/ia-grades-loader-ui/releases/latest";
