import type { components } from "./schema";

type ValidationError = components["schemas"]["ValidationError"];

// Error normalizado de la API: { detail } en 4xx, { detail: ValidationError[] } en 422,
// { detail, request_id } en 500. status 0 = no hubo respuesta (red caída, CORS…).
export class ApiError extends Error {
  readonly status: number;
  readonly requestId: string | null;
  /** Errores de validación (422) por campo del formulario */
  readonly fieldErrors: Record<string, string>;
  /** Segundos de espera indicados por la API en un 429 */
  readonly retryAfter: number | null;

  constructor(options: {
    status: number;
    message: string;
    requestId?: string | null;
    fieldErrors?: Record<string, string>;
    retryAfter?: number | null;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.requestId = options.requestId ?? null;
    this.fieldErrors = options.fieldErrors ?? {};
    this.retryAfter = options.retryAfter ?? null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// loc = ["body", "email"] → "email"; ["query", "q"] → "q"
function fieldName(loc: ValidationError["loc"]): string {
  return loc.filter((part) => part !== "body").join(".") || "_";
}

export function toApiError(response: Response, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  const requestId =
    (body as { request_id?: string } | null)?.request_id ?? response.headers.get("X-Request-ID");
  // La API envía Retry-After en los 429 y lo expone por CORS
  const retryAfterHeader = Number(response.headers.get("Retry-After"));
  const retryAfter =
    Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader : null;

  if (response.status === 422 && Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as ValidationError[]) {
      fieldErrors[fieldName(item.loc)] ??= item.msg;
    }
    return new ApiError({
      status: 422,
      message: "Revisa los datos del formulario.",
      fieldErrors,
      requestId,
    });
  }

  // 503 con detalle = servicio no disponible y explicado (p. ej. la IA no está configurada)
  if (response.status === 503 && typeof detail === "string") {
    return new ApiError({ status: 503, message: detail, requestId });
  }

  if (response.status >= 500) {
    return new ApiError({
      status: response.status,
      message: `Error inesperado del servidor. Si se repite, comunica este código: ${requestId ?? "sin código"}.`,
      requestId,
    });
  }

  if (response.status === 429) {
    return new ApiError({
      status: 429,
      message:
        typeof detail === "string"
          ? detail
          : `Demasiadas solicitudes. Espera ${retryAfter ?? "unos"} segundos.`,
      retryAfter,
      requestId,
    });
  }

  return new ApiError({
    status: response.status,
    message: typeof detail === "string" ? detail : `Error ${response.status}`,
    requestId,
  });
}

export function networkError(): ApiError {
  return new ApiError({ status: 0, message: "No se puede conectar con la API." });
}
