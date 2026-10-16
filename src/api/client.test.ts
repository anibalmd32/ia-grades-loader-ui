import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "@/lib/config";
import { server } from "@/test/server";
import { api, configureApiAuth, unwrap } from "./client";
import { ApiError } from "./errors";

const ME = `${API_URL}/auth/me`;

// Espera a que la petición falle y devuelve el ApiError
async function failure(request: Promise<unknown>): Promise<ApiError> {
  try {
    await request;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("La petición no falló");
}

afterEach(() => configureApiAuth({ getToken: () => null, onUnauthorized: () => {} }));

describe("cliente de la API", () => {
  it("devuelve los datos de una respuesta correcta", async () => {
    await expect(unwrap(api.GET("/api/v1/health"))).resolves.toMatchObject({ status: "ok" });
  });

  it("añade el token de la sesión", async () => {
    let authorization: string | null = null;
    server.use(
      http.get(ME, ({ request }) => {
        authorization = request.headers.get("Authorization");
        return HttpResponse.json({});
      }),
    );
    configureApiAuth({ getToken: () => "abc", onUnauthorized: () => {} });
    await unwrap(api.GET("/api/v1/auth/me"));
    expect(authorization).toBe("Bearer abc");
  });

  it("avisa de la sesión caducada en un 401", async () => {
    const onUnauthorized = vi.fn();
    configureApiAuth({ getToken: () => "caducado", onUnauthorized });
    server.use(
      http.get(ME, () => HttpResponse.json({ detail: "No autenticado" }, { status: 401 })),
    );
    await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("no trata un 401 del login como sesión caducada", async () => {
    const onUnauthorized = vi.fn();
    configureApiAuth({ getToken: () => null, onUnauthorized });
    server.use(
      http.post(`${API_URL}/auth/login/staff`, () =>
        HttpResponse.json({ detail: "Credenciales inválidas" }, { status: 401 }),
      ),
    );
    const login = unwrap(
      api.POST("/api/v1/auth/login/staff", { body: { email: "a@b.com", password: "x" } }),
    );
    await expect(login).rejects.toThrow("Credenciales inválidas");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("incluye el request_id en los errores 500", async () => {
    server.use(
      http.get(ME, () =>
        HttpResponse.json(
          { detail: "Internal Server Error", request_id: "req-123" },
          { status: 500 },
        ),
      ),
    );
    const error = await failure(unwrap(api.GET("/api/v1/auth/me")));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.requestId).toBe("req-123");
    expect(error.message).toContain("req-123");
  });

  it("mapea los errores 422 a campos del formulario", async () => {
    server.use(
      http.post(`${API_URL}/auth/login/staff`, () =>
        HttpResponse.json(
          { detail: [{ loc: ["body", "email"], msg: "Email no válido", type: "value_error" }] },
          { status: 422 },
        ),
      ),
    );
    const error = await failure(
      unwrap(api.POST("/api/v1/auth/login/staff", { body: { email: "x", password: "x" } })),
    );
    expect(error.status).toBe(422);
    expect(error.fieldErrors).toEqual({ email: "Email no válido" });
  });

  it("lee Retry-After en un 429", async () => {
    server.use(
      http.get(ME, () =>
        HttpResponse.json(
          { detail: "Demasiadas preguntas" },
          { status: 429, headers: { "Retry-After": "30" } },
        ),
      ),
    );
    const error = await failure(unwrap(api.GET("/api/v1/auth/me")));
    expect(error.retryAfter).toBe(30);
    expect(error.message).toBe("Demasiadas preguntas");
  });

  it("convierte un fallo de red en ApiError con status 0", async () => {
    server.use(http.get(ME, () => HttpResponse.error()));
    await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toMatchObject({ status: 0 });
  });
});
