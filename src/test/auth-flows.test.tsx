import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { API_URL } from "@/lib/config";
import { usePreferences } from "@/stores/preferences";
import { useSession } from "@/stores/session";
import { makeUser, renderApp, signedInAs, signedOut } from "./app";
import { server } from "./server";

const token = (role = "coordinator", mustChange = false) => ({
  access_token: "nuevo",
  token_type: "bearer",
  expires_in: 3600,
  role,
  must_change_password: mustChange,
});

beforeEach(() => {
  localStorage.clear();
  signedOut();
  usePreferences.setState({ loginTab: "staff" });
});

async function expectPath(router: ReturnType<typeof renderApp>["router"], path: string) {
  await waitFor(() => expect(router.state.location.pathname).toBe(path));
}

describe("instalador", () => {
  it("crea el super admin (nombre y apellido) y entra en la app", async () => {
    let body: unknown;
    server.use(
      http.get(`${API_URL}/setup/status`, () => HttpResponse.json({ installed: false })),
      http.post(`${API_URL}/setup`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(token("super_admin"), { status: 201 });
      }),
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(makeUser({ role: "super_admin" }))),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/setup");

    await user.type(await screen.findByLabelText("Nombre"), "Anibal");
    await user.type(screen.getByLabelText("Apellido"), "Torres ");
    await user.type(screen.getByLabelText("Email"), "admin@uni.edu");
    await user.type(screen.getByLabelText("Contraseña"), "secreta123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "secreta123");
    await user.click(screen.getByRole("button", { name: "Crear super admin" }));

    await expectPath(router, "/admin/coordinators");
    expect(body).toEqual({
      first_name: "Anibal",
      last_name: "Torres",
      email: "admin@uni.edu",
      password: "secreta123",
    });
    expect(useSession.getState().token).toBe("nuevo");
  });

  it("valida que las contraseñas coincidan", async () => {
    server.use(http.get(`${API_URL}/setup/status`, () => HttpResponse.json({ installed: false })));
    const user = userEvent.setup();
    renderApp("/setup");

    await user.type(await screen.findByLabelText("Nombre"), "Anibal");
    await user.type(screen.getByLabelText("Apellido"), "Torres");
    await user.type(screen.getByLabelText("Email"), "admin@uni.edu");
    await user.type(screen.getByLabelText("Contraseña"), "secreta123");
    await user.type(screen.getByLabelText("Confirmar contraseña"), "otra12345");
    await user.click(screen.getByRole("button", { name: "Crear super admin" }));

    expect(await screen.findByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });
});

describe("login", () => {
  it("el personal entra con email y va a su sección", async () => {
    server.use(
      http.post(`${API_URL}/auth/login/staff`, () => HttpResponse.json(token())),
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(makeUser())),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await user.type(await screen.findByLabelText("Email"), "carmen@uni.edu");
    await user.type(screen.getByLabelText("Contraseña"), "clave");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await expectPath(router, "/admin/teachers");
  });

  it("vuelve a la ruta que se pidió antes del login", async () => {
    server.use(
      http.post(`${API_URL}/auth/login/staff`, () => HttpResponse.json(token())),
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(makeUser())),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/admin/students");
    await expectPath(router, "/login");

    await user.type(await screen.findByLabelText("Email"), "carmen@uni.edu");
    await user.type(screen.getByLabelText("Contraseña"), "clave");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await expectPath(router, "/admin/students");
  });

  it("muestra un mensaje genérico con credenciales inválidas", async () => {
    server.use(
      http.post(`${API_URL}/auth/login/staff`, () =>
        HttpResponse.json({ detail: "Credenciales inválidas" }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/login");

    await user.type(await screen.findByLabelText("Email"), "carmen@uni.edu");
    await user.type(screen.getByLabelText("Contraseña"), "mala");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("Email o contraseña incorrectos.")).toBeInTheDocument();
  });

  it("el estudiante entra con V/E y cédula numérica", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/auth/login/student`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(token("student"));
      }),
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json(
          makeUser({ role: "student", email: null, nationality: "E", cedula: 845 }),
        ),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await user.click(await screen.findByRole("tab", { name: "Estudiante" }));
    await user.selectOptions(screen.getByLabelText("Tipo de cédula"), "E");
    await user.type(screen.getByLabelText("Número de cédula"), "845");
    await user.type(screen.getByLabelText("Contraseña"), "clave");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await expectPath(router, "/student/grades");
    expect(body).toEqual({ nationality: "E", cedula: 845, password: "clave" });
    // Recuerda la pestaña usada
    expect(usePreferences.getState().loginTab).toBe("student");
  });

  it("no acepta letras ni puntos en la cédula", async () => {
    usePreferences.setState({ loginTab: "student" });
    const user = userEvent.setup();
    renderApp("/login");

    await user.type(await screen.findByLabelText("Número de cédula"), "12.345");
    await user.type(screen.getByLabelText("Contraseña"), "clave");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(
      await screen.findByText("Escribe solo números, sin puntos ni letras."),
    ).toBeInTheDocument();
  });

  it("si la contraseña es generada, obliga a cambiarla", async () => {
    server.use(
      http.post(`${API_URL}/auth/login/staff`, () => HttpResponse.json(token("teacher", true))),
      http.get(`${API_URL}/auth/me`, () =>
        HttpResponse.json(makeUser({ role: "teacher", must_change_password: true })),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    await user.type(await screen.findByLabelText("Email"), "jose@uni.edu");
    await user.type(screen.getByLabelText("Contraseña"), "generada");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await expectPath(router, "/change-password");
  });

  it("avisa cuando la sesión expiró", async () => {
    useSession.setState({ expired: true });
    renderApp("/login");
    expect(
      await screen.findByText("Tu sesión expiró. Vuelve a iniciar sesión."),
    ).toBeInTheDocument();
  });
});

describe("cambio de contraseña y cierre de sesión", () => {
  it("cambia la contraseña y vuelve a entrar con la nueva", async () => {
    let relogin: unknown;
    server.use(
      http.post(`${API_URL}/auth/change-password`, () => new HttpResponse(null, { status: 204 })),
      http.post(`${API_URL}/auth/login/staff`, async ({ request }) => {
        relogin = await request.json();
        return HttpResponse.json(token("teacher"));
      }),
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(makeUser({ role: "teacher" }))),
    );
    signedInAs(makeUser({ role: "teacher", email: "jose@uni.edu", must_change_password: true }));
    const user = userEvent.setup();
    const { router } = renderApp("/change-password");

    await user.type(await screen.findByLabelText("Contraseña actual"), "generada");
    await user.type(screen.getByLabelText("Nueva contraseña"), "nueva12345");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "nueva12345");
    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));

    await expectPath(router, "/teacher/subjects");
    expect(relogin).toEqual({ email: "jose@uni.edu", password: "nueva12345" });
  });

  it("marca la contraseña actual si no es correcta", async () => {
    server.use(
      http.post(`${API_URL}/auth/change-password`, () =>
        HttpResponse.json({ detail: "Contraseña incorrecta" }, { status: 400 }),
      ),
    );
    signedInAs(makeUser());
    const user = userEvent.setup();
    renderApp("/change-password");

    await user.type(await screen.findByLabelText("Contraseña actual"), "mala");
    await user.type(screen.getByLabelText("Nueva contraseña"), "nueva12345");
    await user.type(screen.getByLabelText("Confirmar nueva contraseña"), "nueva12345");
    await user.click(screen.getByRole("button", { name: "Guardar y continuar" }));

    expect(await screen.findByText("La contraseña actual no es correcta.")).toBeInTheDocument();
  });

  it("cerrar sesión limpia la sesión y vuelve al login", async () => {
    signedInAs(makeUser());
    const user = userEvent.setup();
    const { router } = renderApp("/admin/teachers");

    const [signOutButton] = await screen.findAllByRole("button", { name: "Cerrar sesión" });
    await user.click(signOutButton);

    await expectPath(router, "/login");
    expect(useSession.getState().token).toBeNull();
  });
});

describe("modo claro/oscuro", () => {
  it("se puede cambiar desde el login, sin sesión", async () => {
    usePreferences.setState({ theme: "light" });
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Cambiar a modo oscuro" }));
    expect(usePreferences.getState().theme).toBe("dark");
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "notas-dark"),
    );
  });

  it("está en la app con sesión (menú lateral y barra superior en móvil)", async () => {
    usePreferences.setState({ theme: "dark" });
    server.use(
      http.get(`${API_URL}/teachers`, () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    );
    signedInAs(makeUser());
    renderApp("/admin/teachers");

    const toggles = await screen.findAllByRole("button", { name: "Cambiar a modo claro" });
    expect(toggles).toHaveLength(2);
    // La marca: "Notas" y el nombre de la institución de la configuración académica
    expect(screen.getByText("Universidad")).toBeInTheDocument();
    expect(screen.queryByText(/Grades Loader/)).not.toBeInTheDocument();
  });
});
