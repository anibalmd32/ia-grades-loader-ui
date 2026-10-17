import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

const status = (linked: boolean, enabled = true) => ({
  enabled,
  linked,
  bot_username: "VerMisNotasBot",
});
const inMinutes = (m: number) => new Date(Date.now() + m * 60_000).toISOString();

beforeEach(() => {
  localStorage.clear();
  signedInAs(
    makeUser({
      id: 7,
      role: "student",
      full_name: "María Pérez",
      email: null,
      nationality: "V",
      cedula: 28456123,
      cedula_display: "V-28456123",
    }),
  );
  server.use(
    http.get(`${API_URL}/auth/me`, () => HttpResponse.json(makeUser({ role: "student" }))),
  );
});
afterEach(() => vi.restoreAllMocks());

describe("telegram", () => {
  it("si el bot no está configurado lo indica y lo quita del menú", async () => {
    server.use(
      http.get(`${API_URL}/student/telegram`, () => HttpResponse.json(status(false, false))),
    );
    renderApp("/student/telegram");

    expect(await screen.findByText("Telegram no está disponible")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryAllByRole("link", { name: /Telegram/ })).toHaveLength(0),
    );
  });

  it("genera el enlace, lo abre y avisa cuando queda vinculado", async () => {
    let linked = false;
    server.use(
      http.get(`${API_URL}/student/telegram`, () => HttpResponse.json(status(linked))),
      http.post(`${API_URL}/student/telegram/link`, () =>
        HttpResponse.json({
          url: "https://t.me/VerMisNotasBot?start=abc123",
          expires_at: inMinutes(10),
        }),
      ),
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    renderApp("/student/telegram");

    expect(
      await screen.findByText("Ábrelo en tu teléfono: se abrirá @VerMisNotasBot en Telegram."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generar enlace" }));

    expect(await screen.findByText("t.me/VerMisNotasBot?start=abc123")).toBeInTheDocument();
    expect(screen.getByText(/Caduca en (10:00|9:5\d) minutos\./)).toBeInTheDocument();
    expect(screen.getByTitle("Código QR del enlace")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir en Telegram" }));
    expect(open).toHaveBeenCalledWith(
      "https://t.me/VerMisNotasBot?start=abc123",
      "_blank",
      "noopener,noreferrer",
    );

    // El estudiante pulsa Iniciar en Telegram: el sondeo lo detecta
    linked = true;
    expect(await screen.findByText("Cuenta vinculada", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getByText("¡Listo! Tu Telegram quedó vinculado.")).toBeInTheDocument();
  });

  it("avisa si el enlace caducó", async () => {
    server.use(
      http.post(`${API_URL}/student/telegram/link`, () =>
        HttpResponse.json({
          url: "https://t.me/VerMisNotasBot?start=old",
          expires_at: inMinutes(-1),
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/student/telegram");

    await user.click(await screen.findByRole("button", { name: "Generar enlace" }));
    expect(await screen.findByText("El enlace caducó. Genera uno nuevo.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir en Telegram" })).not.toBeInTheDocument();
  });

  it("desvincula con confirmación", async () => {
    let linked = true;
    server.use(
      http.get(`${API_URL}/student/telegram`, () => HttpResponse.json(status(linked))),
      http.delete(`${API_URL}/student/telegram`, () => {
        linked = false;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/student/telegram");

    await user.click(await screen.findByRole("button", { name: "Desvincular Telegram" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Desvincular" }),
    );

    expect(await screen.findByText("Telegram desvinculado.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Generar enlace" })).toBeInTheDocument();
  });
});
