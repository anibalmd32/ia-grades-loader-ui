import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SubjectGrades, TeacherSubject } from "@/api/queries/teacher";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { makeSettings, personName, settingsHandler } from "./handlers";
import { server } from "./server";

const s2026 = { id: 1, name: "2026-I", is_closed: false };
const s2025 = { id: 2, name: "2025-II", is_closed: false };
const mat: TeacherSubject = {
  id: 10,
  code: "MAT-101",
  name: "Matemática I",
  semester: s2026,
  students_count: 2,
  // Recuento de la API: lapsos 1 y 2 completos, lapso 3 a medias
  grades_count: { "1": 2, "2": 2, "3": 1 },
};
const fis: TeacherSubject = {
  id: 11,
  code: "FIS-101",
  name: "Física I",
  semester: s2025,
  students_count: 0,
  grades_count: { "1": 0, "2": 0, "3": 0 },
};

const maria = { id: 7, ...personName("María Pérez"), cedula_display: "V-28456123" };
const carlos = { id: 8, ...personName("Carlos Gómez"), cedula_display: "V-27118904" };

const grades = (values: [number | null, number | null, number | null]) =>
  values.map((value, i) => ({ term: i + 1, value }));

const matGrades: SubjectGrades = {
  subject: mat,
  students: [
    {
      student: maria,
      grades: grades([15.75, 17, null]),
      average: 16.38,
      final_grade: null,
      passed: null,
    },
    {
      student: carlos,
      grades: grades([9.5, 8, 9]),
      average: 8.83,
      final_grade: 8.83,
      passed: false,
    },
  ],
};

beforeEach(() => {
  localStorage.clear();
  signedInAs(makeUser({ id: 5, role: "teacher", full_name: "José Méndez" }));
  server.use(
    http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([mat, fis])),
    http.get(`${API_URL}/teacher/subjects/10/grades`, () => HttpResponse.json(matGrades)),
    http.get(`${API_URL}/teacher/subjects/11/grades`, () =>
      HttpResponse.json({ subject: fis, students: [] }),
    ),
  );
});

describe("mis materias", () => {
  it("muestra cada materia con las notas cargadas por lapso", async () => {
    renderApp("/teacher/subjects");

    const card = (await screen.findByRole("heading", { name: "Matemática I" })).closest("article");
    if (!card) throw new Error("sin tarjeta");
    expect(within(card).getByText("2 estudiantes matriculados")).toBeInTheDocument();
    expect(await within(card).findByText("1/2 notas")).toBeInTheDocument();
    expect(within(card).getAllByText("2/2 notas")).toHaveLength(2);
    expect(within(card).getByRole("link", { name: "Cargar notas" })).toHaveAttribute(
      "href",
      "/teacher/subjects/10",
    );
    expect(within(card).getByRole("link", { name: "Importar Excel" })).toHaveAttribute(
      "href",
      "/teacher/imports?subject=10",
    );
  });

  it("filtra por búsqueda y por semestre", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects");
    await screen.findByRole("heading", { name: "Física I" });

    await user.selectOptions(screen.getByLabelText("Filtrar por semestre"), "1");
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Física I" })).not.toBeInTheDocument(),
    );

    await user.type(screen.getByLabelText("Buscar materia"), "química");
    expect(await screen.findByText("Sin resultados para la búsqueda")).toBeInTheDocument();
  });

  it("avisa si el profesor no tiene materias", async () => {
    server.use(http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([])));
    renderApp("/teacher/subjects");
    expect(await screen.findByText("Aún no tienes materias asignadas")).toBeInTheDocument();
  });
});

describe("planilla de notas", () => {
  // Escritorio y móvil están en el DOM a la vez: la última celda es la de la tabla
  const cell = async (label: string) =>
    (await screen.findAllByLabelText(label)).at(-1) as HTMLElement;

  it("muestra el resumen y la definitiva solo con los 3 lapsos", async () => {
    renderApp("/teacher/subjects/10");

    expect(await screen.findByText("Aprobados")).toBeInTheDocument();
    const table = screen.getByRole("table");
    expect(within(table).getByText("En curso")).toBeInTheDocument();
    expect(within(table).getByText("8.83")).toHaveClass("text-error");
    expect(await cell("María Pérez · Lapso 1")).toHaveValue("15.75");
  });

  it("guarda solo las notas cambiadas, con coma decimal y vacío para borrar", async () => {
    let body: unknown;
    server.use(
      http.put(`${API_URL}/teacher/subjects/10/grades`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(matGrades);
      }),
    );
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10");

    const [save] = await screen.findAllByRole("button", { name: "Guardar cambios" });
    expect(save).toBeDisabled();

    const maria3 = await cell("María Pérez · Lapso 3");
    await user.type(maria3, "12,5");
    const carlos1 = await cell("Carlos Gómez · Lapso 1");
    await user.clear(carlos1);

    const saveTwo = screen.getAllByRole("button", { name: "Guardar cambios (2)" })[0];
    await user.click(saveTwo);

    await waitFor(() =>
      expect(body).toEqual({
        grades: [
          { student_id: 7, term: 3, value: 12.5 },
          { student_id: 8, term: 1, value: null },
        ],
      }),
    );
    expect(await screen.findByText("2 notas guardadas.")).toBeInTheDocument();
  });

  it("no deja guardar una nota fuera de rango y explica el error", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10");

    await user.type(await cell("María Pérez · Lapso 3"), "25");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "María Pérez · Lapso 3: la nota debe estar entre 1 y 20, con hasta 2 decimales.",
    );
    expect(screen.getAllByRole("button", { name: "Guardar cambios (1)" })[0]).toBeDisabled();
  });

  it("pide confirmación al salir con cambios sin guardar", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/teacher/subjects/10");

    await user.type(await cell("María Pérez · Lapso 3"), "14");
    await user.click(screen.getAllByRole("link", { name: "Mis materias" })[0]);

    expect(await screen.findByText("¿Salir sin guardar?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Seguir editando" }));
    expect(router.state.location.pathname).toBe("/teacher/subjects/10");

    await user.click(screen.getAllByRole("link", { name: "Mis materias" })[0]);
    await user.click(await screen.findByRole("button", { name: "Salir sin guardar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/teacher/subjects"));
  });

  it("cambiar de lapso, buscar o filtrar no pide confirmación ni pierde los cambios", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/teacher/subjects/10");

    await user.type(await cell("María Pérez · Lapso 3"), "14");
    // Pestañas de lapso (móvil) y filtro: cambian solo los search params
    await user.click(screen.getByRole("tab", { name: "Lapso 2" }));
    await user.selectOptions(screen.getByLabelText("Filtrar estudiantes"), "all");

    await waitFor(() => expect(router.state.location.search).toMatchObject({ term: 2 }));
    expect(screen.queryByText("¿Salir sin guardar?")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Guardar cambios (1)" }).length).toBeGreaterThan(
      0,
    );
  });

  it("bloquea las celdas mientras se guarda para no perder lo que se escriba", async () => {
    let release: () => void = () => {};
    server.use(
      http.put(`${API_URL}/teacher/subjects/10/grades`, async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
        return HttpResponse.json(matGrades);
      }),
    );
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10");

    await user.type(await cell("María Pérez · Lapso 3"), "14");
    await user.click(screen.getAllByRole("button", { name: "Guardar cambios (1)" })[0]);

    await waitFor(async () => expect(await cell("Carlos Gómez · Lapso 2")).toBeDisabled());
    release();
    await waitFor(async () => expect(await cell("Carlos Gómez · Lapso 2")).toBeEnabled());
  });

  it("filtra a los reprobados", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10");
    await screen.findByRole("table");

    await user.selectOptions(screen.getByLabelText("Filtrar estudiantes"), "failed");
    await waitFor(() =>
      expect(within(screen.getByRole("table")).queryByText("María Pérez")).not.toBeInTheDocument(),
    );
    expect(within(screen.getByRole("table")).getByText("Carlos Gómez")).toBeInTheDocument();
  });
});

describe("con otra configuración académica", () => {
  // Escala del 0 al 100 sin decimales, 4 cortes y se aprueba con 60
  const settings = makeSettings({
    terms_count: 4,
    term_label: "Corte",
    term_label_plural: "Cortes",
    min_grade: 0,
    max_grade: 100,
    passing_grade: 60,
    grade_decimals: 0,
    summary: "La definitiva es el promedio simple de los 4 cortes y se aprueba con 60 o más",
  });
  const four = (values: (number | null)[]) => values.map((value, i) => ({ term: i + 1, value }));
  const subject: TeacherSubject = { ...mat, grades_count: { "1": 2, "2": 2, "3": 1, "4": 0 } };
  const data: SubjectGrades = {
    subject,
    students: [
      {
        student: maria,
        grades: four([85, 70, null, null]),
        average: 78,
        final_grade: null,
        passed: null,
      },
      {
        student: carlos,
        grades: four([50, 55, 60, 52]),
        average: 54,
        final_grade: 54,
        passed: false,
      },
    ],
  };

  beforeEach(() => {
    server.use(
      settingsHandler(settings),
      http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([subject])),
      http.get(`${API_URL}/teacher/subjects/10/grades`, () => HttpResponse.json(data)),
    );
  });

  it("la planilla muestra una columna por corte y valida con la escala configurada", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10");

    const table = await screen.findByRole("table");
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((th) => th.textContent),
      ).toEqual(["Estudiante", "Corte 1", "Corte 2", "Corte 3", "Corte 4", "Definitiva"]),
    );
    // Sin decimales: 85, no 85.00; la definitiva y el aprobado vienen de la API
    expect(await screen.findAllByLabelText("María Pérez · Corte 1")).not.toHaveLength(0);
    expect(screen.getAllByLabelText("María Pérez · Corte 1").at(-1) as HTMLElement).toHaveValue(
      "85",
    );
    expect(within(table).getByText("54")).toHaveClass("text-error");
    expect(screen.getByText(/se aprueba con 60 o más/)).toBeInTheDocument();

    const cell4 = screen.getAllByLabelText("María Pérez · Corte 4").at(-1) as HTMLElement;
    await user.type(cell4, "85.5");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "María Pérez · Corte 4: la nota debe estar entre 0 y 100, sin decimales.",
    );
    await user.clear(cell4);
    await user.type(cell4, "100");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Guardar cambios (1)" })[0]).toBeEnabled();
  });

  it("el selector de corte en móvil admite el cuarto", async () => {
    const { router } = renderApp("/teacher/subjects/10?term=4");

    expect(await screen.findByRole("tab", { name: "Corte 4" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(router.state.location.search).toMatchObject({ term: 4 });
  });

  it("mis materias muestra el avance de los 4 cortes", async () => {
    renderApp("/teacher/subjects");

    const card = (await screen.findByRole("heading", { name: "Matemática I" })).closest("article");
    if (!card) throw new Error("sin tarjeta");
    expect(await within(card).findByText("Corte 4")).toBeInTheDocument();
    expect(within(card).getByText("0/2 notas")).toBeInTheDocument();
  });
});
