import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL, RELEASES_URL } from "@/lib/config";
import { usePreferences } from "@/stores/preferences";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({ theme: "system" });
  server.use(
    http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([])),
    http.get(`${API_URL}/student/subjects`, () =>
      HttpResponse.json({ subjects: [], average: null }),
    ),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("mi cuenta", () => {
  it("muestra los datos del personal y la versión, y descarga la última versión", async () => {
    signedInAs(makeUser({ role: "teacher", full_name: "José Méndez", email: "jose@uni.edu" }));
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    renderApp("/profile");

    expect(await screen.findByRole("heading", { name: "José Méndez" })).toBeInTheDocument();
    expect(screen.getByText("jose@uni.edu")).toBeInTheDocument();
    expect(screen.getAllByText("Profesor").length).toBeGreaterThan(0);
    expect(screen.getByText(API_URL)).toBeInTheDocument();
    expect(screen.getByText(/Se cerrarán todas tus sesiones/i)).toBeInTheDocument();
    const change = screen
      .getAllByRole("link", { name: "Cambiar contraseña" })
      .find((link) => link.closest("main"));
    expect(change).toHaveAttribute("href", "/change-password");

    await user.click(screen.getByRole("button", { name: "Descargar la última versión" }));
    expect(open).toHaveBeenCalledWith(RELEASES_URL, "_blank", "noopener,noreferrer");
  });

  it("al estudiante le muestra la cédula y si vinculó Telegram", async () => {
    signedInAs(
      makeUser({
        role: "student",
        full_name: "María Pérez",
        email: null,
        nationality: "V",
        cedula: 28456123,
        cedula_display: "V-28456123",
        telegram_linked: true,
      }),
    );
    renderApp("/profile");

    expect(await screen.findByText("V-28456123")).toBeInTheDocument();
    expect(screen.getByText("Vinculado")).toBeInTheDocument();
  });

  it("cambia el tema y cierra la sesión", async () => {
    signedInAs(makeUser({ role: "coordinator" }));
    server.use(
      http.get(`${API_URL}/teachers`, () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/profile");

    await user.selectOptions(await screen.findByLabelText("Tema"), "dark");
    await waitFor(() =>
      expect(document.documentElement).toHaveAttribute("data-theme", "notas-dark"),
    );

    const logout = screen
      .getAllByRole("button", { name: "Cerrar sesión" })
      .find((b) => b.closest("main"));
    await user.click(logout as HTMLElement);
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
  });

  it("se llega desde la pestaña Cuenta y desde la tarjeta del usuario", async () => {
    signedInAs(makeUser({ role: "teacher" }));
    renderApp("/teacher/subjects");

    expect(await screen.findByRole("link", { name: "Cuenta" })).toHaveAttribute("href", "/profile");
    expect(screen.getAllByRole("link", { name: "Mi cuenta" })[0]).toHaveAttribute(
      "href",
      "/profile",
    );
  });
});
