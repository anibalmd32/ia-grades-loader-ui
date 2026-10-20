import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "@/lib/config";
import { usePreferences } from "@/stores/preferences";
import { makeUser, renderApp, signedOut } from "./app";
import { server } from "./server";

const biometric = vi.hoisted(() => ({ mobile: true, results: [] as boolean[], calls: 0 }));
vi.mock("@/lib/biometric", () => ({
  isMobileApp: () => biometric.mobile,
  biometricAvailable: async () => biometric.mobile,
  verifyIdentity: async () => {
    biometric.calls += 1;
    return biometric.results.shift() ?? true;
  },
}));

const credential = { deviceId: 3, credential: "3.secreto", userId: 7, name: "María Pérez" };
const student = makeUser({ id: 7, role: "student", full_name: "María Pérez" });

beforeEach(() => {
  localStorage.clear();
  signedOut();
  biometric.mobile = true;
  biometric.results = [];
  biometric.calls = 0;
  usePreferences.setState({ loginTab: "staff", biometricLock: true, biometricLogin: credential });
});

describe("login con huella", () => {
  it("entra sin usuario ni contraseña tras verificar la huella", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/auth/login/biometric`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          access_token: "nuevo",
          token_type: "bearer",
          expires_in: 3600,
          role: "student",
          must_change_password: false,
        });
      }),
      http.get(`${API_URL}/auth/me`, () => HttpResponse.json(student)),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/login");

    expect(await screen.findByText("Como María Pérez")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Entrar con huella" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/student/grades"));
    expect(body).toEqual({ credential: "3.secreto" });
    // Ya se identificó: la app no vuelve a pedir la huella al entrar
    expect(biometric.calls).toBe(1);
    expect(screen.queryByText("Notas está bloqueada")).not.toBeInTheDocument();
  });

  it("también aparece en la pestaña de estudiantes", async () => {
    usePreferences.setState({ loginTab: "student" });
    renderApp("/login");
    expect(await screen.findByRole("button", { name: "Entrar con huella" })).toBeInTheDocument();
  });

  it("si la huella no se verifica, no llama a la API", async () => {
    const login = vi.fn();
    server.use(http.post(`${API_URL}/auth/login/biometric`, login));
    biometric.results = [false];
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Entrar con huella" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo verificar");
    expect(login).not.toHaveBeenCalled();
  });

  it("si la credencial ya no vale, la olvida y pide la contraseña", async () => {
    server.use(
      http.post(`${API_URL}/auth/login/biometric`, () =>
        HttpResponse.json({ detail: "Credenciales incorrectas" }, { status: 401 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/login");

    await user.click(await screen.findByRole("button", { name: "Entrar con huella" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Entra con tu contraseña");
    expect(usePreferences.getState().biometricLogin).toBeNull();
  });

  it("no aparece si no se activó o fuera del móvil", async () => {
    usePreferences.setState({ biometricLock: false });
    const { unmount } = renderApp("/login");
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entrar con huella" })).not.toBeInTheDocument();
    unmount();

    usePreferences.setState({ biometricLock: true });
    biometric.mobile = false;
    renderApp("/login");
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Entrar con huella" })).not.toBeInTheDocument();
  });
});
