import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { AcademicSettingsUpdate } from "@/api/queries/settings";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { makeSettings } from "./handlers";
import { server } from "./server";

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

beforeEach(() => {
  localStorage.clear();
  server.use(
    http.get(`${API_URL}/coordinators`, () => HttpResponse.json(page([]))),
    http.get(`${API_URL}/teachers`, () => HttpResponse.json(page([]))),
  );
});

describe("configuración académica (super admin)", () => {
  beforeEach(() => signedInAs(makeUser({ role: "super_admin", full_name: "Ana Admin" })));

  it("aparece en el menú y guarda la configuración completa", async () => {
    let body: AcademicSettingsUpdate | undefined;
    server.use(
      http.put(`${API_URL}/settings/academic`, async ({ request }) => {
        body = (await request.json()) as AcademicSettingsUpdate;
        return HttpResponse.json(
          makeSettings({
            institution_name: "UNEFA",
            period_type: "trimester",
            terms_count: 4,
            term_label: "Corte",
            period_label: "Trimestre",
            period_label_plural: "Trimestres",
            term_label_plural: "Cortes",
          }),
        );
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/admin/coordinators");

    await user.click(
      (await screen.findAllByRole("link", { name: "Configuración" }))[0] as HTMLElement,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/settings"));

    const name = await screen.findByLabelText("Nombre de la institución");
    expect(name).toHaveValue("Universidad");
    expect(screen.getByRole("note")).toHaveTextContent(/importación desde Excel y al asistente IA/);

    await user.clear(name);
    await user.type(name, "UNEFA");
    await user.selectOptions(screen.getByLabelText("Tipo de periodo"), "trimester");
    const count = screen.getByLabelText("Número de evaluaciones por periodo");
    await user.clear(count);
    await user.type(count, "4");
    const label = screen.getByLabelText("Nombre de cada evaluación");
    await user.clear(label);
    await user.type(label, "Corte");
    await user.click(screen.getByLabelText("Redondear la definitiva al entero (9,5 → 10)"));

    // La vista previa cambia mientras se escribe
    expect(screen.getByTestId("settings-preview")).toHaveTextContent(
      "La definitiva es el promedio simple de los 4 cortes, redondeado al entero (9.5 → 10) y se aprueba con 10 o más.",
    );

    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect(await screen.findByText("Configuración guardada.")).toBeInTheDocument();
    expect(body).toEqual({
      institution_name: "UNEFA",
      period_type: "trimester",
      terms_count: 4,
      term_label: "Corte",
      term_weights: null,
      min_grade: 1,
      max_grade: 20,
      passing_grade: 10,
      grade_decimals: 2,
      round_final_grade: true,
      document_label: "Cédula",
      document_types: [
        { code: "V", name: "Venezolano" },
        { code: "E", name: "Extranjero" },
      ],
      assistant_enabled: true,
      telegram_enabled: true,
    });
    // La marca usa la configuración nueva; el menú dice siempre "Periodo escolar"
    expect((await screen.findAllByText("Periodo escolar")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("UNEFA").length).toBeGreaterThan(0);
  });

  it("con porcentajes personalizados exige que sumen 100", async () => {
    let body: AcademicSettingsUpdate | undefined;
    server.use(
      http.put(`${API_URL}/settings/academic`, async ({ request }) => {
        body = (await request.json()) as AcademicSettingsUpdate;
        return HttpResponse.json(makeSettings({ term_weights: [30, 30, 40] }));
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/settings");

    await user.click(await screen.findByLabelText("Porcentajes personalizados"));
    const weights = [1, 2, 3].map((n) => screen.getByLabelText(`Lapso ${n} (%)`));
    for (const input of weights) {
      await user.clear(input);
      await user.type(input, "30");
    }
    expect(screen.getByText(/Total: 90 %/)).toHaveClass("text-error");

    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(await screen.findByText(/entre todos sumar 100/)).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.clear(weights[2] as HTMLElement);
    await user.type(weights[2] as HTMLElement, "40");
    expect(screen.getByText(/Total: 100 %/)).toHaveClass("text-success");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    await waitFor(() => expect(body?.term_weights).toEqual([30, 30, 40]));
  });

  it("valida la escala antes de enviarla", async () => {
    const user = userEvent.setup();
    renderApp("/admin/settings");

    const passing = await screen.findByLabelText("Nota aprobatoria");
    await user.clear(passing);
    await user.type(passing, "25");
    await user.selectOptions(screen.getByLabelText("Decimales admitidos"), "0");
    const min = screen.getByLabelText("Nota mínima");
    await user.clear(min);
    await user.type(min, "1.5");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    expect(
      await screen.findByText("Debe ser mayor que la mínima y no mayor que la máxima."),
    ).toBeInTheDocument();
    expect(screen.getByText("Tiene más decimales de los admitidos.")).toBeInTheDocument();
  });

  it("explica por qué la API rechaza el cambio (409)", async () => {
    server.use(
      http.put(`${API_URL}/settings/academic`, () =>
        HttpResponse.json(
          {
            detail:
              "Hay 12 notas cargadas en lapsos posteriores al 2. Bórralas antes de reducir el número de lapsos.",
          },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/settings");

    const count = await screen.findByLabelText("Número de evaluaciones por periodo");
    await user.clear(count);
    await user.type(count, "2");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    const alert = await screen.findByText(/Hay 12 notas cargadas/);
    expect(alert.closest("[role=alert]")).toBeInTheDocument();
  });
});

describe("configuración académica (coordinador)", () => {
  beforeEach(() => signedInAs(makeUser({ role: "coordinator" })));

  it("no la ve en el menú ni puede entrar", async () => {
    const { router } = renderApp("/admin/settings");

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/teachers"));
    const menus = await screen.findAllByRole("navigation");
    for (const menu of menus) {
      expect(within(menu).queryByRole("link", { name: "Configuración" })).not.toBeInTheDocument();
    }
    expect(screen.queryByLabelText("Nombre de la institución")).not.toBeInTheDocument();
  });
});
