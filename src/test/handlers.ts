import { HttpResponse, http } from "msw";
import { API_URL } from "@/lib/config";

// Respuestas por defecto de la API simulada; cada test puede sobrescribirlas con server.use()
export const handlers = [
  http.get(`${API_URL}/health`, () => HttpResponse.json({ status: "ok" })),
  http.get(`${API_URL}/setup/status`, () => HttpResponse.json({ installed: true })),
  http.post(`${API_URL}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  // El menú del estudiante consulta si Telegram está disponible
  http.get(`${API_URL}/student/telegram`, () =>
    HttpResponse.json({ enabled: true, linked: false, bot_username: "VerMisNotasBot" }),
  ),
];
