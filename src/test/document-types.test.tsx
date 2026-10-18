import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { AcademicSettingsUpdate } from "@/api/queries/settings";
import { documentNoun } from "@/components/form/document-fields";
import { API_URL } from "@/lib/config";
import { usePreferences } from "@/stores/preferences";
import { makeUser, renderApp, signedInAs, signedOut } from "./app";
import { makeSettings, settingsHandler } from "./handlers";
import { server } from "./server";

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

// Un tercer tipo de documento y otro nombre para el documento
const settings = makeSettings({
  document_label: "DNI",
  document_types: [
    { code: "V", name: "Venezolano" },
    { code: "E", name: "Extranjero" },
    { code: "P", name: "Pasaporte" },
  ],
});

const student = makeUser({
  id: 7,
  role: "student",
  full_name: "Ana Rivas",
  email: null,
  nationality: "P",
  cedula: 1234567,
  cedula_display: "P-1234567",
});

beforeEach(() => {
  localStorage.clear();
  server.use(settingsHandler(settings));
});

describe("documento configurable", () => {
  it("el login de estudiantes ofrece los tipos configurados y usa el nombre del documento", async () => {
    let body: unknown;
    signedOut();
    usePreferences.setState({ loginTab: "student" });
    server.use(
      http.post(`${API_URL}/auth/login/student`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ detail: "x" }, { status: 401 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/login");

    const type = await screen.findByLabelText("Tipo de DNI");
    await waitFor(() =>
      expect(
        within(type)
          .getAllByRole("option")
          .map((o) => o.textContent),
      ).toEqual(["V", "E", "P"]),
    );
    expect(screen.getByText("V = venezolano · E = extranjero · P = pasaporte")).toBeInTheDocument();
    expect(screen.getByText("Entra con tu DNI y contraseña.")).toBeInTheDocument();

    await user.selectOptions(type, "P");
    await user.type(screen.getByLabelText("Número de DNI"), "1234567");
    await user.type(screen.getByLabelText("Contraseña"), "clave");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByText("DNI o contraseña incorrectos.")).toBeInTheDocument();
    expect(body).toEqual({ nationality: "P", cedula: 1234567, password: "clave" });
  });

  describe("coordinación", () => {
    beforeEach(() => {
      signedInAs(makeUser({ role: "coordinator", full_name: "Carmen Rojas" }));
      server.use(
        http.get(`${API_URL}/students`, () => HttpResponse.json(page([student]))),
        http.get(`${API_URL}/subjects`, () => HttpResponse.json(page([]))),
      );
    });

    it("el alta de estudiante ofrece el tercer tipo", async () => {
      let created: unknown;
      server.use(
        http.post(`${API_URL}/students`, async ({ request }) => {
          created = await request.json();
          return HttpResponse.json({ user: student, generated_password: "Est-1" }, { status: 201 });
        }),
      );
      const user = userEvent.setup();
      renderApp("/admin/students/new");

      await user.type(await screen.findByLabelText("Nombre"), "Ana");
      await user.type(screen.getByLabelText("Apellido"), "Rivas");
      const type = screen.getByLabelText("Tipo de DNI");
      await within(type).findByRole("option", { name: "P" });
      await user.selectOptions(type, "P");
      await user.type(screen.getByLabelText("Número de DNI"), "1234567");
      await user.click(screen.getByRole("button", { name: "Crear estudiante" }));

      expect(await screen.findByTestId("generated-password")).toHaveTextContent("Est-1");
      expect(screen.getByText("Ana Rivas · DNI P-1234567")).toBeInTheDocument();
      expect(created).toEqual({
        first_name: "Ana",
        last_name: "Rivas",
        nationality: "P",
        cedula: 1234567,
      });
    });

    it("la lista de estudiantes usa el nombre del documento", async () => {
      renderApp("/admin/students");

      const table = await screen.findByRole("table");
      await waitFor(() =>
        expect(within(table).getByRole("columnheader", { name: "DNI" })).toBeInTheDocument(),
      );
      expect(screen.getByPlaceholderText("Buscar por nombre o DNI")).toBeInTheDocument();
    });
  });

  it("el super admin edita el nombre y los tipos de documento", async () => {
    let body: AcademicSettingsUpdate | undefined;
    signedInAs(makeUser({ role: "super_admin", full_name: "Ana Admin" }));
    server.use(
      settingsHandler(makeSettings()),
      http.put(`${API_URL}/settings/academic`, async ({ request }) => {
        body = (await request.json()) as AcademicSettingsUpdate;
        return HttpResponse.json(makeSettings(body as never));
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/settings");

    const label = await screen.findByLabelText("Nombre del documento");
    expect(label).toHaveValue("Cédula");
    await user.clear(label);
    await user.type(label, "DNI");

    // Un código repetido no se puede guardar
    await user.click(screen.getByRole("button", { name: "Añadir tipo" }));
    await user.type(screen.getByLabelText("Código del tipo 3"), "v");
    await user.type(screen.getByLabelText("Nombre del tipo 3"), "Pasaporte");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));
    expect(
      await screen.findByText("Hay tipos de documento con el mismo código."),
    ).toBeInTheDocument();
    expect(body).toBeUndefined();

    const code = screen.getByLabelText("Código del tipo 3");
    await user.clear(code);
    await user.type(code, "p");
    await user.click(screen.getByRole("button", { name: "Guardar configuración" }));

    await waitFor(() =>
      expect(body).toMatchObject({
        document_label: "DNI",
        document_types: [
          { code: "V", name: "Venezolano" },
          { code: "E", name: "Extranjero" },
          { code: "P", name: "Pasaporte" },
        ],
      }),
    );

    // Siempre queda al menos un tipo
    await user.click(screen.getByRole("button", { name: "Quitar el tipo 3" }));
    await user.click(screen.getByRole("button", { name: "Quitar el tipo 2" }));
    expect(screen.getByRole("button", { name: "Quitar el tipo 1" })).toBeDisabled();
  });
});

describe("documentNoun", () => {
  it("pone en minúscula el nombre salvo las siglas", () => {
    expect(documentNoun("Cédula")).toBe("cédula");
    expect(documentNoun("DNI")).toBe("DNI");
  });
});
