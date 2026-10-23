import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentImportResult, StudentImportRow } from "@/api/queries/admin";
import { API_URL } from "@/lib/config";
import { toCsv } from "@/lib/download";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

// El FormData de jsdom no se puede enviar con el fetch de Node: se simula importStudents (el
// multipart se prueba en src/api/queries/admin.test.ts). Sin vi.fn, como en teacher-imports
const imports = vi.hoisted(() => ({
  calls: [] as [File, boolean][],
  respond: (_dryRun: boolean): unknown => undefined,
}));
vi.mock("@/api/queries/admin", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/queries/admin")>()),
  importStudents: (file: File, dryRun: boolean) => {
    imports.calls.push([file, dryRun]);
    return Promise.resolve(imports.respond(dryRun));
  },
}));

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

const row = (overrides: Partial<StudentImportRow>): StudentImportRow => ({
  row: 2,
  first_name: "Ana",
  last_name: "Rivas",
  nationality: "V",
  cedula: 30111222,
  subject_codes: ["MAT-101"],
  section: "A",
  status: "new",
  issues: [],
  user: null,
  generated_password: null,
  ...overrides,
});

const preview: StudentImportResult = {
  dry_run: true,
  rows: [
    row({}),
    row({
      row: 3,
      first_name: "María",
      last_name: "Pérez",
      cedula: 28456123,
      status: "existing",
      issues: ["Ya existe: solo se matricula"],
    }),
    row({
      row: 4,
      first_name: "Luis",
      last_name: "",
      cedula: null,
      subject_codes: [],
      status: "error",
      issues: ["Falta la cédula"],
    }),
  ],
  summary: { new: 1, existing: 1, error: 1 },
};

const created: StudentImportResult = {
  ...preview,
  dry_run: false,
  rows: [
    row({
      user: makeUser({
        id: 30,
        role: "student",
        full_name: "Ana Rivas",
        email: null,
        nationality: "V",
        cedula: 30111222,
        cedula_display: "V-30111222",
      }),
      generated_password: "k7Q2-mXp9",
    }),
    ...preview.rows.slice(1),
  ],
};

const xlsx = () =>
  new File(["contenido"], "estudiantes.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

beforeEach(() => {
  localStorage.clear();
  imports.calls = [];
  signedInAs(makeUser({ role: "coordinator", full_name: "Carmen Rojas" }));
  server.use(http.get(`${API_URL}/students`, () => HttpResponse.json(page([]))));
  // jsdom no implementa las URL de objetos que usa la descarga
  URL.createObjectURL = vi.fn(() => "blob:archivo");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => vi.restoreAllMocks());

describe("alta masiva de estudiantes", () => {
  it("se llega desde la lista de estudiantes", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/admin/students");

    await user.click(
      (await screen.findAllByRole("link", { name: "Importar desde Excel" }))[0] as HTMLElement,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/students/import"));
    expect(await screen.findByText("Columnas del Excel")).toBeInTheDocument();
  });

  it("revisa el archivo, crea los estudiantes y muestra sus contraseñas una vez", async () => {
    imports.respond = (dryRun) => (dryRun ? preview : created);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp("/admin/students/import");

    await user.upload(await screen.findByLabelText("Archivo Excel"), xlsx());
    await user.click(screen.getByRole("button", { name: "Revisar archivo" }));

    // Revisión: estado de cada fila y resumen
    expect((await screen.findAllByText("Falta la cédula")).length).toBeGreaterThan(0);
    const table = screen.getByRole("table");
    expect(within(table).getByText("Nuevo")).toBeInTheDocument();
    expect(within(table).getByText("Ya existe")).toBeInTheDocument();
    expect(within(table).getByText("V-30111222")).toBeInTheDocument();
    // Sección que se le asigna en el periodo de sus materias
    expect(within(table).getByRole("columnheader", { name: "Sección" })).toBeInTheDocument();
    expect(screen.getByText("Nuevos").previousSibling).toHaveTextContent("1");
    expect(imports.calls).toEqual([[expect.objectContaining({ name: "estudiantes.xlsx" }), true]]);

    await user.click(screen.getByRole("button", { name: "Crear 1 estudiante" }));

    expect(await screen.findByText(/Estas contraseñas solo se muestran ahora/)).toBeInTheDocument();
    expect(screen.getAllByText("k7Q2-mXp9").length).toBeGreaterThan(0);
    expect(screen.getByText(/1 estudiante creado; 1 ya existía/)).toBeInTheDocument();
    expect(imports.calls.map(([, dryRun]) => dryRun)).toEqual([true, false]);
    // Se envía el mismo archivo que se revisó
    expect(imports.calls[1]?.[0]).toBe(imports.calls[0]?.[0]);

    await user.click(screen.getByRole("button", { name: "Descargar credenciales (CSV)" }));
    expect(click).toHaveBeenCalled();
    const blob = vi.mocked(URL.createObjectURL).mock.calls.at(-1)?.[0] as Blob;
    const csv = await blob.text();
    expect(csv).toContain("Nombre,Apellido,Cédula,Contraseña");
    expect(csv).toContain("Ana,Rivas,V-30111222,k7Q2-mXp9");
  });

  it("no deja confirmar si ninguna fila es válida", async () => {
    imports.respond = () => ({
      ...preview,
      rows: [preview.rows[2]],
      summary: { new: 0, existing: 0, error: 1 },
    });
    const user = userEvent.setup();
    renderApp("/admin/students/import");

    await user.upload(await screen.findByLabelText("Archivo Excel"), xlsx());
    await user.click(screen.getByRole("button", { name: "Revisar archivo" }));

    expect(await screen.findByRole("button", { name: "Crear estudiantes" })).toBeDisabled();
  });

  it("descarga la plantilla con la sesión", async () => {
    let auth: string | null = null;
    server.use(
      http.get(`${API_URL}/students/import/template`, ({ request }) => {
        auth = request.headers.get("Authorization");
        // Bytes y no un Blob: el Blob de jsdom no lo acepta el fetch nativo de Node (falla en Linux)
        return new HttpResponse(new TextEncoder().encode("xlsx"), {
          headers: { "Content-Type": "application/octet-stream" },
        });
      }),
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const user = userEvent.setup();
    renderApp("/admin/students/import");

    await user.click(await screen.findByRole("button", { name: "Descargar plantilla" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(auth).toBe("Bearer tok");
  });
});

describe("toCsv", () => {
  it("entrecomilla los campos con separadores o comillas", async () => {
    const text = await toCsv([["a,b", 'di "hola"', "c"]]).text();
    expect(text).toContain('"a,b","di ""hola""",c');
  });

  it("neutraliza los textos que Excel tomaría por fórmulas", async () => {
    const text = await toCsv([['=HYPERLINK("x")', "@SUM(A1)", "Ana"]]).text();
    expect(text).toContain(`"'=HYPERLINK(""x"")",'@SUM(A1),Ana`);
  });
});
