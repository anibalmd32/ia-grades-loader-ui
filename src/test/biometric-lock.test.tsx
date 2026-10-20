import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BiometricGate, RELOCK_AFTER_MS } from "@/components/layout/biometric-lock";
import { API_URL } from "@/lib/config";
import { usePreferences } from "@/stores/preferences";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

const biometric = vi.hoisted(() => ({
  available: true,
  results: [] as boolean[],
  calls: 0,
}));
vi.mock("@/lib/biometric", () => ({
  isMobileApp: () => false,
  biometricAvailable: async () => biometric.available,
  verifyIdentity: async () => {
    biometric.calls += 1;
    return biometric.results.shift() ?? true;
  },
}));
const navigate = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));
// Altas (POST /auth/biometric) y bajas (DELETE) de la credencial del teléfono en la API simulada
const registered: number[] = [];
const removed: number[] = [];

beforeEach(() => {
  localStorage.clear();
  biometric.available = true;
  biometric.results = [];
  biometric.calls = 0;
  navigate.mockClear();
  usePreferences.setState({ biometricLock: false, biometricLogin: null });
  registered.length = 0;
  removed.length = 0;
  server.use(
    http.post(`${API_URL}/auth/biometric`, () => {
      registered.push(registered.length + 1);
      return HttpResponse.json(
        { device_id: registered.length, credential: `${registered.length}.secreto` },
        { status: 201 },
      );
    }),
    http.delete(`${API_URL}/auth/biometric/:id`, ({ params }) => {
      removed.push(Number(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  signedInAs(makeUser({ id: 7, role: "student", full_name: "María Pérez" }));
});

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("bloqueo con huella", () => {
  it("sin activarlo, o fuera del móvil, muestra la app directamente", () => {
    const { rerender } = render(
      <BiometricGate mobile>
        <p>Contenido</p>
      </BiometricGate>,
    );
    expect(screen.getByText("Contenido")).toBeInTheDocument();

    usePreferences.setState({ biometricLock: true });
    rerender(
      <BiometricGate mobile={false}>
        <p>Contenido</p>
      </BiometricGate>,
    );
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    expect(biometric.calls).toBe(0);
  });

  it("al abrir la app pide la huella y deja reintentar si falla", async () => {
    const user = userEvent.setup();
    usePreferences.setState({ biometricLock: true });
    biometric.results = [false, true];
    render(
      <BiometricGate mobile>
        <p>Contenido</p>
      </BiometricGate>,
    );

    expect(await screen.findByText("Notas está bloqueada")).toBeInTheDocument();
    expect(screen.getByText(/Hola, María/)).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo verificar");
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Desbloquear" }));
    expect(await screen.findByText("Contenido")).toBeInTheDocument();
    expect(biometric.calls).toBe(2);
  });

  it("se vuelve a bloquear tras un rato en segundo plano", async () => {
    usePreferences.setState({ biometricLock: true });
    const now = vi.spyOn(Date, "now");
    render(
      <BiometricGate mobile>
        <p>Contenido</p>
      </BiometricGate>,
    );
    expect(await screen.findByText("Contenido")).toBeInTheDocument();

    now.mockReturnValue(1_000);
    act(() => setVisibility("hidden"));
    now.mockReturnValue(1_000 + 60_000);
    act(() => setVisibility("visible"));
    expect(screen.getByText("Contenido")).toBeInTheDocument();

    act(() => setVisibility("hidden"));
    now.mockReturnValue(1_000 + 60_000 + RELOCK_AFTER_MS + 1);
    biometric.results = [false];
    act(() => setVisibility("visible"));
    expect(await screen.findByText("Notas está bloqueada")).toBeInTheDocument();
    now.mockRestore();
  });

  it("entrar con la contraseña cierra la sesión", async () => {
    const user = userEvent.setup();
    usePreferences.setState({ biometricLock: true });
    biometric.results = [false];
    render(
      <BiometricGate mobile>
        <p>Contenido</p>
      </BiometricGate>,
    );
    await user.click(await screen.findByRole("button", { name: "Entrar con mi contraseña" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/login" }));
    // La credencial del teléfono se conserva para poder entrar con la huella desde el login
    expect(usePreferences.getState().biometricLock).toBe(true);
  });

  it("si se activó sin credencial para el login, la pide tras desbloquear", async () => {
    usePreferences.setState({ biometricLock: true });
    render(
      <BiometricGate mobile>
        <p>Contenido</p>
      </BiometricGate>,
    );
    expect(await screen.findByText("Contenido")).toBeInTheDocument();
    await waitFor(() => expect(usePreferences.getState().biometricLogin?.userId).toBe(7));
    expect(registered).toEqual([1]);
  });
});

describe("ajuste en Mi cuenta", () => {
  it("se activa solo tras verificar la huella", async () => {
    const user = userEvent.setup();
    biometric.results = [false, true];
    renderApp("/profile");
    const toggle = await screen.findByRole("checkbox", {
      name: "Entrar con la huella, la cara o el PIN del teléfono",
    });

    await user.click(toggle);
    expect(await screen.findByRole("alert")).toHaveTextContent("sigue desactivado");
    expect(usePreferences.getState().biometricLock).toBe(false);

    expect(registered).toEqual([]);

    // Al activarlo, el teléfono recibe su credencial para entrar con huella desde el login
    await user.click(toggle);
    await waitFor(() => expect(usePreferences.getState().biometricLock).toBe(true));
    expect(usePreferences.getState().biometricLogin).toEqual({
      deviceId: 1,
      credential: "1.secreto",
      userId: 7,
      name: "María Pérez",
    });

    // Al desactivarlo, se olvida y se borra en la API
    await user.click(toggle);
    expect(usePreferences.getState().biometricLock).toBe(false);
    await waitFor(() => expect(removed).toEqual([1]));
    expect(usePreferences.getState().biometricLogin).toBeNull();
  });

  it("si la activación falla en la API, sigue desactivado", async () => {
    server.use(
      http.post(`${API_URL}/auth/biometric`, () =>
        HttpResponse.json({ detail: "Error" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/profile");
    await user.click(
      await screen.findByRole("checkbox", {
        name: "Entrar con la huella, la cara o el PIN del teléfono",
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo activar");
    expect(usePreferences.getState().biometricLock).toBe(false);
  });

  it("no aparece si el dispositivo no tiene biometría", async () => {
    biometric.available = false;
    renderApp("/profile");
    expect(await screen.findByText("Acerca de la app")).toBeInTheDocument();
    expect(screen.queryByText("Entrar con huella")).not.toBeInTheDocument();
  });
});
