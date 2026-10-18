import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/errors";
import type {
  ImportJobRead,
  ImportRow,
  SubjectGrades,
  TeacherSubject,
} from "@/api/queries/teacher";
import { API_URL } from "@/lib/config";
import { useImportReviews } from "@/stores/import-reviews";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

// uploadImport simulado sin vi.fn: Vitest da por fallido el test si un vi.fn rechaza
const upload = vi.hoisted(() => ({
  calls: [] as unknown[][],
  result: (): Promise<unknown> => Promise.resolve(undefined),
}));
vi.mock("@/api/queries/teacher", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/queries/teacher")>()),
  uploadImport: (...args: unknown[]) => {
    upload.calls.push(args);
    return upload.result();
  },
}));

const s2026 = { id: 1, name: "2026-I" };
const mat: TeacherSubject = {
  id: 10,
  code: "MAT-101",
  name: "Matemática I",
  semester: s2026,
  students_count: 3,
  grades_count: { "1": 3, "2": 0, "3": 0 },
};
const maria = { id: 7, full_name: "María Pérez", cedula_display: "V-28456123" };
const carlos = { id: 8, full_name: "Carlos Gómez", cedula_display: "V-27118904" };
const sofia = { id: 9, full_name: "Sofía Linares", cedula_display: "V-28990034" };

const summary = {
  id: "job-1",
  subject_id: 10,
  file_name: "notas_lapso2.xlsx",
  error: null,
  created_at: "2026-10-16T12:00:00Z",
  started_at: null,
  finished_at: null,
  attempts: 1,
  confirmed_at: null,
};

const row = (overrides: Partial<ImportRow>): ImportRow => ({
  sheet: "Hoja1",
  row: 2,
  raw_cedula: null,
  raw_name: null,
  raw_value: null,
  student: null,
  term: 2,
  value: null,
  current_value: null,
  status: "ok",
  issues: [],
  ...overrides,
});

const doneJob: ImportJobRead = {
  ...summary,
  status: "done",
  finished_at: "2026-10-16T12:01:00Z",
  result: {
    subject: mat,
    rows: [
      row({ row: 2, raw_name: "Maria Perez", student: maria, value: 17, raw_value: "17" }),
      row({
        row: 3,
        raw_name: "C. Gomez",
        student: carlos,
        value: 12.25,
        current_value: 11,
        status: "warning",
        issues: ["Identificado por nombre"],
      }),
      row({
        row: 4,
        raw_name: "Sofía Linares",
        student: sofia,
        value: null,
        raw_value: "25",
        status: "error",
        issues: ["Fuera de rango"],
      }),
      row({
        row: 5,
        raw_name: "Pedro Lugo",
        raw_cedula: "30111222",
        value: 16,
        status: "error",
        issues: ["No matriculado"],
      }),
    ],
    summary: { ok: 1, warning: 1, error: 2 },
    warnings: [],
    students_without_grades: [],
  },
};

const emptyGrades: SubjectGrades = { subject: mat, students: [] };

beforeEach(() => {
  localStorage.clear();
  useImportReviews.setState({ reviews: {} });
  signedInAs(makeUser({ id: 5, role: "teacher", full_name: "José Méndez" }));
  server.use(
    http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([mat])),
    http.get(`${API_URL}/teacher/import-jobs`, () => HttpResponse.json([])),
    http.get(`${API_URL}/teacher/subjects/10/grades`, () => HttpResponse.json(emptyGrades)),
  );
});

const xlsx = (name = "notas_lapso2.xlsx") => new File(["PK"], name);

describe("subir un Excel", () => {
  // El FormData de jsdom no se puede enviar con el fetch de Node: aquí se comprueba con qué
  // datos se llama a uploadImport (el FormData se prueba en src/api/queries/teacher.test.ts)
  beforeEach(() => {
    upload.calls = [];
  });

  it("envía archivo, materia y lapso, y abre el seguimiento del trabajo", async () => {
    upload.result = async () => ({ ...summary, status: "pending" });
    server.use(
      http.get(`${API_URL}/teacher/import-jobs/job-1`, () =>
        HttpResponse.json({ ...summary, status: "pending", result: null }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/teacher/imports?subject=10");

    await screen.findByRole("option", { name: "MAT-101 · Matemática I" });
    expect(screen.getByLabelText("Materia")).toHaveValue("10");
    await user.selectOptions(screen.getByLabelText("Lapso"), "2");
    await user.upload(screen.getByLabelText("Archivo Excel"), xlsx());
    await user.click(screen.getByRole("button", { name: "Subir y procesar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/teacher/imports/job-1"));
    expect(upload.calls).toEqual([[10, expect.objectContaining({ name: "notas_lapso2.xlsx" }), 2]]);
    expect(await screen.findByText("En cola")).toBeInTheDocument();
  });

  it("rechaza archivos que no son .xlsx", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderApp("/teacher/imports?subject=10");

    await user.upload(await screen.findByLabelText("Archivo Excel"), xlsx("notas.xls"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Solo se admiten archivos .xlsx");
    expect(screen.getByRole("button", { name: "Subir y procesar" })).toBeDisabled();
    expect(upload.calls).toEqual([]);
  });

  it("muestra el límite de importaciones simultáneas (429)", async () => {
    upload.result = async () => {
      throw new ApiError({
        status: 429,
        message: "Ya tienes 5 importaciones en curso; espera a que terminen (máximo 5)",
      });
    };
    const user = userEvent.setup();
    renderApp("/teacher/imports?subject=10");

    await user.upload(await screen.findByLabelText("Archivo Excel"), xlsx());
    await user.click(screen.getByRole("button", { name: "Subir y procesar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Ya tienes 5 importaciones");
  });
});

describe("seguimiento y revisión", () => {
  it("muestra el error si la IA no pudo leer el archivo", async () => {
    server.use(
      http.get(`${API_URL}/teacher/import-jobs/job-1`, () =>
        HttpResponse.json({
          ...summary,
          status: "failed",
          error: "El archivo no tiene notas reconocibles",
          result: null,
        }),
      ),
    );
    renderApp("/teacher/imports/job-1");

    expect(await screen.findByRole("alert")).toHaveTextContent("no tiene notas reconocibles");
    expect(screen.getByRole("link", { name: "Volver a intentar" })).toHaveAttribute(
      "href",
      "/teacher/imports?subject=10",
    );
  });

  it("confirma solo las filas incluidas y válidas, con las correcciones", async () => {
    let body: unknown;
    server.use(
      http.get(`${API_URL}/teacher/import-jobs/job-1`, () => HttpResponse.json(doneJob)),
      http.put(`${API_URL}/teacher/subjects/10/grades`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(emptyGrades);
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/teacher/imports/job-1");

    // Por defecto: las filas listas y con aviso; las de error no
    const [confirmTwo] = await screen.findAllByRole("button", {
      name: "Confirmar y guardar 2 notas",
    });
    expect(confirmTwo).toBeEnabled();
    expect(screen.getByLabelText('Guardar Fila 5 · "Pedro Lugo 30111222"')).toBeDisabled();

    // Corregir la nota fuera de rango la incluye
    await user.type(screen.getByLabelText("Nota de Sofía Linares"), "18,5");
    // Excluir a Carlos
    await user.click(screen.getByLabelText("Guardar Carlos Gómez"));

    await user.click(
      screen.getAllByRole("button", { name: "Confirmar y guardar 2 notas" })[0] as HTMLElement,
    );

    await waitFor(() =>
      expect(body).toEqual({
        grades: [
          { student_id: 7, term: 2, value: 17 },
          { student_id: 9, term: 2, value: 18.5 },
        ],
        // La API marca la importación como confirmada (confirmed_at)
        import_job_id: "job-1",
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/teacher/subjects/10"));
  });

  it("no deja confirmar dos notas del mismo estudiante y lapso", async () => {
    const result = doneJob.result as NonNullable<ImportJobRead["result"]>;
    const twice: ImportJobRead = {
      ...doneJob,
      result: {
        ...result,
        rows: [
          ...result.rows,
          row({ row: 9, raw_name: "M. Pérez", student: maria, value: 15, status: "warning" }),
        ],
      },
    };
    server.use(http.get(`${API_URL}/teacher/import-jobs/job-1`, () => HttpResponse.json(twice)));
    const user = userEvent.setup();
    renderApp("/teacher/imports/job-1");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "María Pérez tiene dos notas para el lapso 2",
    );
    expect(screen.getAllByRole("button", { name: /Confirmar y guardar/ })[0]).toBeDisabled();

    // Pasar la segunda al lapso 3 resuelve el conflicto
    const second = screen.getAllByLabelText("Lapso de María Pérez")[1] as HTMLElement;
    await user.selectOptions(second, "3");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Confirmar y guardar 3 notas" })[0]).toBeEnabled();
  });

  it("descartar no guarda nada y vuelve a importaciones", async () => {
    server.use(http.get(`${API_URL}/teacher/import-jobs/job-1`, () => HttpResponse.json(doneJob)));
    const user = userEvent.setup();
    const { router } = renderApp("/teacher/imports/job-1");

    await user.click(
      (await screen.findAllByRole("button", { name: "Descartar" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Descartar" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/teacher/imports"));
    expect(useImportReviews.getState().reviews["job-1"]).toBe("discarded");
  });

  it("avisa antes de volver a confirmar una importación ya confirmada", async () => {
    let saved = false;
    server.use(
      // La API ya registró la confirmación
      http.get(`${API_URL}/teacher/import-jobs/job-1`, () =>
        HttpResponse.json({ ...doneJob, confirmed_at: "2026-10-16T12:05:00Z" }),
      ),
      http.put(`${API_URL}/teacher/subjects/10/grades`, () => {
        saved = true;
        return HttpResponse.json({});
      }),
    );
    const user = userEvent.setup();
    renderApp("/teacher/imports/job-1");

    await user.click(
      (await screen.findAllByRole("button", { name: /Confirmar y guardar/ }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Esta importación ya se confirmó");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(saved).toBe(false);
  });
});

describe("historial de importaciones", () => {
  it("lista cada importación con su estado y abre la revisión", async () => {
    const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
    // Descartar solo se recuerda en el dispositivo; confirmar lo registra la API
    useImportReviews.setState({ reviews: { "job-6": "discarded" } });
    server.use(
      http.get(`${API_URL}/teacher/import-jobs`, () =>
        HttpResponse.json([
          { ...summary, id: "job-1", status: "processing", created_at: minutesAgo(1) },
          { ...summary, id: "job-2", file_name: "fisica.xlsx", status: "done" },
          {
            ...summary,
            id: "job-3",
            file_name: "lista.xlsx",
            status: "failed",
            error: "Sin notas",
          },
          {
            ...summary,
            id: "job-4",
            file_name: "viejas.xlsx",
            status: "done",
            attempts: 2,
            confirmed_at: minutesAgo(30),
          },
          { ...summary, id: "job-5", file_name: "cola.xlsx", status: "pending" },
          { ...summary, id: "job-6", file_name: "descartada.xlsx", status: "done" },
        ]),
      ),
      http.get(`${API_URL}/teacher/import-jobs/job-2`, () =>
        HttpResponse.json({ ...doneJob, id: "job-2" }),
      ),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/teacher/imports");

    const item = async (name: string) =>
      (await screen.findByText(name)).closest("a") as HTMLElement;

    expect(within(await item("notas_lapso2.xlsx")).getByText("Procesando")).toBeInTheDocument();
    expect(
      within(await item("notas_lapso2.xlsx")).getByText(/MAT-101 · hace 1 minuto/),
    ).toBeInTheDocument();
    expect(within(await item("fisica.xlsx")).getByText("Lista para revisar")).toBeInTheDocument();
    expect(within(await item("lista.xlsx")).getByText("Falló")).toBeInTheDocument();
    expect(within(await item("lista.xlsx")).getByText(/Sin notas/)).toBeInTheDocument();
    expect(within(await item("viejas.xlsx")).getByText("Confirmada")).toBeInTheDocument();
    expect(within(await item("viejas.xlsx")).getByText(/2 intentos/)).toBeInTheDocument();
    expect(within(await item("descartada.xlsx")).getByText("Descartada")).toBeInTheDocument();
    expect(within(await item("cola.xlsx")).getByText("En cola")).toBeInTheDocument();

    await user.click(await item("fisica.xlsx"));
    await waitFor(() => expect(router.state.location.pathname).toBe("/teacher/imports/job-2"));
    expect(await screen.findByText("Revisa la importación")).toBeInTheDocument();
  });

  it("avisa si aún no hay importaciones", async () => {
    renderApp("/teacher/imports");
    expect(await screen.findByText("Aún no has importado archivos")).toBeInTheDocument();
  });
});
