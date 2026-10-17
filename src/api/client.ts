import createClient from "openapi-fetch";
import { API_BASE_URL } from "@/lib/config";
import { ApiError, networkError, toApiError } from "./errors";
import type { paths } from "./schema";

type AuthHooks = {
  /** Token de la sesión actual (o null si no hay sesión) */
  getToken: () => string | null;
  /** Se llama ante un 401 fuera del login: la sesión caducó o se cerró */
  onUnauthorized: () => void;
};

// La sesión (store de Zustand) registra aquí cómo leer el token y qué hacer ante un 401
let auth: AuthHooks = { getToken: () => null, onUnauthorized: () => {} };

export function configureApiAuth(hooks: AuthHooks) {
  auth = hooks;
}

// En el login un 401 significa credenciales inválidas, no sesión caducada
const PUBLIC_PATHS = ["/api/v1/auth/login/", "/api/v1/auth/token", "/api/v1/setup"];

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
  // Resolver fetch en cada petición (no al importar), para que lo puedan interceptar MSW u otros
  fetch: (request) => globalThis.fetch(request),
});

api.use({
  onRequest({ request }) {
    const token = auth.getToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  onResponse({ request, response }) {
    const path = new URL(request.url).pathname;
    if (response.status === 401 && !PUBLIC_PATHS.some((p) => path.startsWith(p))) {
      auth.onUnauthorized();
    }
  },
});

/**
 * fetch con el token de la sesión, para lo que openapi-fetch no cubre (respuestas en streaming).
 * Ante un 401 caduca la sesión y, si la respuesta no es 2xx, lanza un ApiError.
 */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = auth.getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let response: Response;
  try {
    response = await globalThis.fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
  if (response.status === 401) auth.onUnauthorized();
  if (!response.ok) throw toApiError(response, await response.json().catch(() => null));
  return response;
}

type FetchResult<T> = { data?: T; error?: unknown; response: Response };

/**
 * Devuelve `data` o lanza un ApiError. Uso:
 * `const me = await unwrap(api.GET("/api/v1/auth/me"))`
 */
export async function unwrap<T>(request: Promise<FetchResult<T>>): Promise<T> {
  let result: FetchResult<T>;
  try {
    result = await request;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw networkError();
  }
  if (!result.response.ok) throw toApiError(result.response, result.error);
  return result.data as T;
}
