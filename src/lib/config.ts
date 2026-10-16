declare global {
  interface Window {
    __APP_CONFIG__?: { API_URL?: string };
  }
}

// URL base de la API (incluye /api/v1). En Docker se configura al arrancar el
// contenedor (public/config.js); si no, se usa VITE_API_URL del build (ver .env.example).
export const API_URL: string =
  (typeof window !== "undefined" && window.__APP_CONFIG__?.API_URL) || import.meta.env.VITE_API_URL;
