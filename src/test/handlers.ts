import { HttpResponse, http } from "msw";
import { type AcademicSettings, DEFAULT_ACADEMIC_SETTINGS } from "@/api/queries/settings";
import { API_URL, LATEST_RELEASE_API } from "@/lib/config";

/** Configuración académica de los tests: la de por defecto con los cambios indicados */
export function makeSettings(overrides: Partial<AcademicSettings> = {}): AcademicSettings {
  return { ...DEFAULT_ACADEMIC_SETTINGS, ...overrides };
}

/** Sustituye la configuración académica que devuelve la API simulada */
export function settingsHandler(settings: AcademicSettings) {
  return http.get(`${API_URL}/settings/academic`, () => HttpResponse.json(settings));
}

/** "María Pérez" → { first_name: "María", last_name: "Pérez", full_name: "María Pérez" } */
export function personName(fullName: string) {
  const [first = fullName, ...rest] = fullName.split(" ");
  return { first_name: first, last_name: rest.join(" "), full_name: fullName };
}

// Respuestas por defecto de la API simulada; cada test puede sobrescribirlas con server.use()
export const handlers = [
  // Última versión publicada (botones de descarga del login)
  http.get(LATEST_RELEASE_API, () => HttpResponse.json({ tag_name: "v0.1.0" })),
  http.get(`${API_URL}/health`, () => HttpResponse.json({ status: "ok" })),
  http.get(`${API_URL}/setup/status`, () => HttpResponse.json({ installed: true })),
  // Reglas académicas (pública): las de siempre, 3 lapsos del 1 al 20 y se aprueba con 10
  settingsHandler(makeSettings()),
  http.post(`${API_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  // La app del estudiante busca avisos nuevos cada minuto
  http.get(`${API_URL}/student/notifications`, () =>
    HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0, unread: 0 }),
  ),
  // Tiempo real de los avisos: sin stream por defecto (la app reintenta más tarde)
  http.get(
    `${API_URL}/student/notifications/stream`,
    () => new HttpResponse(null, { status: 204 }),
  ),
  // El menú del estudiante consulta si Telegram está disponible
  http.get(`${API_URL}/student/telegram`, () =>
    HttpResponse.json({ enabled: true, linked: false, bot_username: "VerMisNotasBot" }),
  ),
];
