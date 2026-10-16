import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs, signedOut } from "./app";
import { server } from "./server";

beforeEach(() => {
  localStorage.clear();
  signedOut();
});

async function expectPath(router: ReturnType<typeof renderApp>["router"], path: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
}

describe("rutas y guardas", () => {
  it("sin sesión, / lleva al login", async () => {
    const { router } = renderApp("/");
    await expectPath(router, "/login");
    expect(await screen.findByRole("heading", { name: "Inicia sesión" })).toBeInTheDocument();
  });

  it("una ruta privada sin sesión lleva al login recordando a dónde volver", async () => {
    const { router } = renderApp("/admin/teachers");
    await expectPath(router, "/login");
    expect(router.state.location.search).toMatchObject({ redirect: "/admin/teachers" });
  });

  it("si no hay super admin, el login lleva al instalador", async () => {
    server.use(http.get(`${API_URL}/setup/status`, () => HttpResponse.json({ installed: false })));
    const { router } = renderApp("/login");
    await expectPath(router, "/setup");
    expect(await screen.findByRole("heading", { name: "Instala el sistema" })).toBeInTheDocument();
  });

  it("con el sistema instalado, el instalador no se muestra", async () => {
    const { router } = renderApp("/setup");
    await expectPath(router, "/login");
  });

  it("cada rol entra en su sección de inicio", async () => {
    signedInAs(makeUser({ role: "teacher" }));
    const { router } = renderApp("/");
    await expectPath(router, "/teacher/subjects");
  });

  it("un rol no puede entrar en la sección de otro", async () => {
    signedInAs(makeUser({ role: "student", email: null, cedula: 123, nationality: "V" }));
    const { router } = renderApp("/admin/teachers");
    await expectPath(router, "/student/grades");
  });

  it("solo el super admin ve coordinadores", async () => {
    signedInAs(makeUser({ role: "coordinator" }));
    const { router } = renderApp("/admin/coordinators");
    await expectPath(router, "/admin/teachers");
  });

  it("el menú muestra las secciones del rol", async () => {
    signedInAs(makeUser({ role: "super_admin" }));
    renderApp("/admin/coordinators");
    const links = await screen.findAllByRole("link", { name: "Coordinadores" });
    expect(links.length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Mis notas" })).not.toBeInTheDocument();
  });

  it("con la contraseña pendiente de cambio solo deja ir a /change-password", async () => {
    signedInAs(makeUser({ must_change_password: true }));
    const { router } = renderApp("/admin/teachers");
    await expectPath(router, "/change-password");
    expect(await screen.findByText(/Debes cambiar la contraseña/)).toBeInTheDocument();
  });

  it("muestra la página 404", async () => {
    renderApp("/no-existe");
    expect(await screen.findByText("Esta página no existe")).toBeInTheDocument();
  });
});
