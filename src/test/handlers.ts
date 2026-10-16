import { HttpResponse, http } from "msw";
import { API_URL } from "@/lib/config";

// Respuestas por defecto de la API simulada; cada test puede sobrescribirlas con server.use()
export const handlers = [http.get(`${API_URL}/health`, () => HttpResponse.json({ status: "ok" }))];
