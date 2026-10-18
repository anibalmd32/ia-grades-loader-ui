import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { api, unwrap } from "@/api/client";
import { API_URL } from "@/lib/config";
import { queryClient } from "@/lib/query-client";
import { server } from "@/test/server";
import { restoreSession, type User, useSession } from "./session";

const ME = `${API_URL}/auth/me`;
const LOGOUT = `${API_URL}/auth/logout`;

const user: User = {
  id: 1,
  role: "coordinator",
  first_name: "Ana",
  last_name: "Pérez",
  full_name: "Ana Pérez",
  email: "ana@uni.edu",
  nationality: null,
  cedula: null,
  cedula_display: null,
  is_active: true,
  must_change_password: false,
  telegram_linked: false,
};

beforeEach(() => {
  localStorage.clear();
  queryClient.clear();
  useSession.setState({ token: null, user: null, status: "anonymous", expired: false });
  server.use(http.get(ME, () => HttpResponse.json(user)));
});

describe("sesión", () => {
  it("inicia sesión guardando el token y cargando el usuario", async () => {
    await useSession.getState().signIn("tok-1");
    const state = useSession.getState();
    expect(state).toMatchObject({ token: "tok-1", status: "authenticated", expired: false });
    expect(state.user?.full_name).toBe("Ana Pérez");
    // Solo el token se persiste
    expect(JSON.parse(localStorage.getItem("session") ?? "{}").state).toEqual({ token: "tok-1" });
  });

  it("si /auth/me falla al iniciar sesión, no deja sesión a medias", async () => {
    server.use(http.get(ME, () => new HttpResponse(null, { status: 500 })));
    await expect(useSession.getState().signIn("tok-1")).rejects.toMatchObject({ status: 500 });
    expect(useSession.getState()).toMatchObject({ token: null, user: null, status: "anonymous" });
  });

  it("caduca la sesión y vacía la caché ante un 401", async () => {
    await useSession.getState().signIn("tok-1");
    queryClient.setQueryData(["algo"], 1);
    server.use(http.get(ME, () => new HttpResponse(null, { status: 401 })));

    await expect(unwrap(api.GET("/api/v1/auth/me"))).rejects.toMatchObject({ status: 401 });

    expect(useSession.getState()).toMatchObject({ token: null, user: null, expired: true });
    expect(queryClient.getQueryData(["algo"])).toBeUndefined();
  });

  it("cierra sesión aunque la llamada a /auth/logout falle", async () => {
    await useSession.getState().signIn("tok-1");
    server.use(http.post(LOGOUT, () => HttpResponse.error()));
    await useSession.getState().signOut();
    expect(useSession.getState()).toMatchObject({
      token: null,
      status: "anonymous",
      expired: false,
    });
  });

  it("restaura una sesión guardada válida", async () => {
    useSession.setState({ token: "tok-1", status: "loading" });
    await restoreSession();
    expect(useSession.getState()).toMatchObject({ status: "authenticated", user: { id: 1 } });
  });

  it("descarta una sesión guardada caducada y avisa", async () => {
    useSession.setState({ token: "viejo", status: "loading" });
    server.use(http.get(ME, () => new HttpResponse(null, { status: 401 })));
    await restoreSession();
    expect(useSession.getState()).toMatchObject({
      token: null,
      status: "anonymous",
      expired: true,
    });
  });

  it("sin token guardado queda anónima sin llamar a la API", async () => {
    useSession.setState({ token: null, status: "loading" });
    await restoreSession();
    expect(useSession.getState().status).toBe("anonymous");
  });
});
