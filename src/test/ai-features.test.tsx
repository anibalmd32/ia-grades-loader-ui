import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { AcademicSettingsUpdate } from "@/api/queries/settings";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { makeSettings, settingsHandler } from "./handlers";
import { server } from "./server";

const student = makeUser({
  id: 7,
  role: "student",
  full_name: "María Pérez",
  email: null,
  nationality: "V",
  cedula: 28456123,
  cedula_display: "V-28456123",
});

const navLinks = (name: RegExp) => screen.queryAllByRole("link", { name });

describe("estudiante", () => {
  beforeEach(() => {
    localStorage.clear();
    signedInAs(student);
    server.use(
      http.get(`${API_URL}/student/subjects`, () =>
        HttpResponse.json({ subjects: [], average: null, semesters: [] }),
      ),
    );
  });

  it("sin asistente no ofrece ni el asistente ni Telegram y lo explica si se entra", async () => {
    server.use(settingsHandler(makeSettings({ assistant_enabled: false })));
    renderApp("/student/assistant");

    expect(
      await screen.findByText("La institución desactivó el asistente de notas"),
    ).toBeInTheDocument();
    expect(navLinks(/Mis notas/).length).toBeGreaterThan(0);
    expect(navLinks(/Asistente IA/)).toHaveLength(0);
    expect(navLinks(/^Telegram/)).toHaveLength(0);
    // No se llega a montar el chat
    expect(screen.queryByRole("button", { name: "Nueva conversación" })).not.toBeInTheDocument();
  });

  it("sin Telegram mantiene el asistente y avisa en la pantalla de Telegram", async () => {
    server.use(settingsHandler(makeSettings({ telegram_enabled: false })));
    renderApp("/student/telegram");

    expect(
      await screen.findByText("La institución desactivó el asistente por Telegram"),
    ).toBeInTheDocument();
    await waitFor(() => expect(navLinks(/Asistente IA/).length).toBeGreaterThan(0));
    expect(navLinks(/^Telegram/)).toHaveLength(0);
  });

  it("si el asistente está desactivado, Telegram también", async () => {
    server.use(settingsHandler(makeSettings({ assistant_enabled: false, telegram_enabled: true })));
    renderApp("/student/telegram");

    expect(
      await screen.findByText("La institución desactivó el asistente por Telegram"),
    ).toBeInTheDocument();
  });

  it("con todo activado aparecen las dos opciones en el menú", async () => {
    renderApp("/student/grades");

    await waitFor(() => expect(navLinks(/^Telegram/).length).toBeGreaterThan(0));
    expect(navLinks(/Asistente IA/).length).toBeGreaterThan(0);
  });
});

describe("configuración", () => {
  it("el super admin desactiva el asistente y Telegram queda bloqueado", async () => {
    let body: AcademicSettingsUpdate | undefined;
    localStorage.clear();
    signedInAs(makeUser({ role: "super_admin", full_name: "Ana Admin" }));
    server.use(
      http.put(`${API_URL}/settings/academic`, async ({ request }) => {
        body = (await request.json()) as AcademicSettingsUpdate;
        return HttpResponse.json(makeSettings(body as never));
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/settings");

    const assistant = await screen.findByRole("checkbox", { name: /Asistente de notas \(IA\)/ });
    const telegram = screen.getByRole("checkbox", { name: /Asistente por Telegram/ });
    expect(assistant).toBeChecked();
    expect(telegram).toBeEnabled();

    await user.click(assistant);
    expect(telegram).toBeDisabled();
    expect(screen.getByText(/Requiere el asistente de notas/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));
    await waitFor(() =>
      expect(body).toMatchObject({ assistant_enabled: false, telegram_enabled: true }),
    );
  });
});
