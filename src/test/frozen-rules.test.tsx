import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SemesterRead } from "@/api/queries/admin";
import type { GradingRules } from "@/api/queries/settings";
import type { StudentOverview } from "@/api/queries/student";
import type { SubjectGrades, TeacherSubject } from "@/api/queries/teacher";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { makeSettings, personName, settingsHandler } from "./handlers";
import { server } from "./server";

// Configuración vigente: 4 cortes del 0 al 100, sin decimales, se aprueba con 60
const current = makeSettings({
  terms_count: 4,
  term_label: "Corte",
  term_label_plural: "Cortes",
  term_percentages: [25, 25, 25, 25],
  min_grade: 0,
  max_grade: 100,
  passing_grade: 60,
  grade_decimals: 0,
  summary: "La definitiva es el promedio simple de los 4 cortes y se aprueba con 60 o más",
});

// Reglas congeladas al cerrar el periodo 2025-II: 3 lapsos del 1 al 20
const frozen: GradingRules = {
  terms_count: 3,
  term_label: "Lapso",
  term_label_plural: "Lapsos",
  term_weights: null,
  term_percentages: [33.33, 33.33, 33.33],
  min_grade: 1,
  max_grade: 20,
  passing_grade: 10,
  grade_decimals: 2,
  round_final_grade: false,
  summary: "La definitiva es el promedio simple de los 3 lapsos y se aprueba con 10 o más",
};

const open: SemesterRead = { id: 1, name: "2026-I", is_closed: false, rules: null };
const closed: SemesterRead = { id: 2, name: "2025-II", is_closed: true, rules: frozen };
// Cerrado y reabierto: se puede editar, pero conserva las reglas de su cierre
const reopened: SemesterRead = { id: 3, name: "2025-I", is_closed: false, rules: frozen };

const maria = { id: 7, ...personName("María Pérez"), cedula_display: "V-28456123" };
const three = (values: (number | null)[]) =>
  values.map((value, i) => ({ term: i + 1, value, absent: false }));

beforeEach(() => {
  localStorage.clear();
  server.use(settingsHandler(current));
});

describe("profesor", () => {
  const subject = (id: number, code: string, name: string, semester: SemesterRead) => ({
    id,
    code,
    name,
    semester,
    section: { id: id + 1, name: "A", semester_id: semester.id },
  });
  const mat: TeacherSubject = {
    ...subject(10, "MAT-101", "Matemática I", open),
    students_count: 1,
    grades_count: { "1": 1, "2": 0, "3": 0, "4": 0 },
  };
  const his: TeacherSubject = {
    ...subject(20, "HIS-100", "Historia", closed),
    students_count: 1,
    grades_count: { "1": 1, "2": 1, "3": 1 },
  };
  const geo: TeacherSubject = {
    ...subject(30, "GEO-100", "Geografía", reopened),
    students_count: 1,
    grades_count: { "1": 1, "2": 0, "3": 0 },
  };
  const gradesOf = (s: TeacherSubject, values: (number | null)[]): SubjectGrades => ({
    subject: s,
    section: s.section,
    students: [
      {
        student: maria,
        grades: three(values),
        average: null,
        final_grade: null,
        passed: null,
      },
    ],
  });

  beforeEach(() => {
    signedInAs(makeUser({ id: 5, role: "teacher", full_name: "José Méndez" }));
    server.use(
      http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([mat, his, geo])),
      http.get(`${API_URL}/teacher/subjects/20/sections/21/grades`, () =>
        HttpResponse.json(gradesOf(his, [15.75, 12, 18])),
      ),
      http.get(`${API_URL}/teacher/subjects/30/sections/31/grades`, () =>
        HttpResponse.json(gradesOf(geo, [15.5, null, null])),
      ),
      http.get(`${API_URL}/teacher/import-jobs`, () => HttpResponse.json([])),
    );
  });

  it("cada tarjeta muestra los lapsos de las reglas de su periodo", async () => {
    renderApp("/teacher/subjects");

    const card = async (name: string) => {
      const article = (await screen.findByRole("heading", { name })).closest("article");
      if (!article) throw new Error("sin tarjeta");
      return within(article);
    };
    expect((await card("Matemática I")).getByText("Corte 4")).toBeInTheDocument();
    const history = await card("Historia");
    expect(history.getByText("Lapso 3")).toBeInTheDocument();
    expect(history.queryByText(/Corte/)).not.toBeInTheDocument();
  });

  it("la planilla de un periodo cerrado usa sus reglas congeladas", async () => {
    renderApp("/teacher/subjects/20/21");

    const table = await screen.findByRole("table");
    await waitFor(() =>
      expect(
        within(table)
          .getAllByRole("columnheader")
          .map((th) => th.textContent),
      ).toEqual(["Estudiante", "Lapso 1", "Lapso 2", "Lapso 3", "Definitiva"]),
    );
    expect(screen.getAllByLabelText("María Pérez · Lapso 1").at(-1)).toHaveValue("15.75");
    expect(screen.getByText(/3 lapsos y se aprueba con 10 o más/)).toBeInTheDocument();
  });

  it("un periodo reabierto se edita y valida con las reglas de su cierre", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects/30/31");

    const cell = (await screen.findAllByLabelText("María Pérez · Lapso 2")).at(-1) as HTMLElement;
    expect(cell).toBeEnabled();
    await user.type(cell, "85");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "María Pérez · Lapso 2: la nota debe estar entre 1 y 20, con hasta 2 decimales (o «I» si es inasistente).",
    );
    await user.clear(cell);
    await user.type(cell, "14,5");
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(screen.getAllByRole("button", { name: "Guardar cambios (1)" })[0]).toBeEnabled();
  });

  it("al importar, los lapsos que se ofrecen son los del periodo de la materia", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/imports");

    const subjectSelect = await screen.findByRole("combobox", { name: "Materia" });
    await within(subjectSelect).findByRole("option", { name: /GEO-100/ });
    await user.selectOptions(subjectSelect, "30:31");
    const termSelect = screen.getByRole("combobox", { name: "Lapso" });
    expect(
      within(termSelect)
        .getAllByRole("option")
        .map((o) => o.textContent),
    ).toEqual(["Lo indica el archivo", "Lapso 1", "Lapso 2", "Lapso 3"]);

    await user.selectOptions(subjectSelect, "10:11");
    const cuts = screen.getByRole("combobox", { name: "Corte" });
    expect(within(cuts).getAllByRole("option")).toHaveLength(5);
  });
});

describe("estudiante", () => {
  const overview: StudentOverview = {
    subjects: [
      {
        subject: { id: 10, code: "MAT-101", name: "Matemática I", semester: open },
        section: "A",
        teacher: null,
        grades: [...three([85, null, null]), { term: 4, value: null, absent: false }],
        average: 85,
        projection: {
          standing: "in_progress",
          final_grade: null,
          pending_terms: [2, 3, 4],
          needed_average: 52,
        },
      },
      {
        subject: { id: 20, code: "HIS-100", name: "Historia", semester: closed },
        section: "A",
        teacher: null,
        grades: three([15.75, 12, 18]),
        average: 15.25,
        projection: {
          standing: "passed",
          final_grade: 15.25,
          pending_terms: [],
          needed_average: null,
        },
      },
    ],
    average: 15.25,
    semesters: [
      { semester: open, average: 85, subjects_count: 1, passed_count: 0, failed_count: 0 },
      { semester: closed, average: 15.25, subjects_count: 1, passed_count: 1, failed_count: 0 },
    ],
  };

  beforeEach(() => {
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
    server.use(http.get(`${API_URL}/student/subjects`, () => HttpResponse.json(overview)));
  });

  it("muestra cada materia con las reglas de su periodo y la regla de cada periodo", async () => {
    const user = userEvent.setup();
    renderApp("/student/grades");

    // Periodo abierto: 4 cortes y notas sin decimales
    expect(await screen.findByText("Corte 4")).toBeInTheDocument();
    expect(screen.getAllByText("85").length).toBeGreaterThan(0);
    // Las reglas difieren: una nota por periodo
    expect(screen.getByText(/4 cortes y se aprueba con 60 o más/)).toBeInTheDocument();
    expect(screen.getByText(/3 lapsos y se aprueba con 10 o más/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Semestre"), "2");
    expect(await screen.findByText("Lapso 3")).toBeInTheDocument();
    expect(screen.queryByText("Corte 1")).not.toBeInTheDocument();
    expect(screen.getAllByText("15.75").length).toBeGreaterThan(0);
  });
});

describe("coordinación", () => {
  it("el panel de periodos muestra las reglas congeladas de los cerrados", async () => {
    signedInAs(makeUser({ role: "coordinator", full_name: "Carmen Rojas" }));
    server.use(
      http.get(`${API_URL}/semesters`, () => HttpResponse.json([open, closed])),
      http.get(`${API_URL}/subjects`, () =>
        HttpResponse.json({ items: [], total: 0, limit: 20, offset: 0 }),
      ),
    );
    renderApp("/admin/academic");

    expect(
      await screen.findByText(
        "Reglas congeladas: La definitiva es el promedio simple de los 3 lapsos y se aprueba con 10 o más.",
      ),
    ).toBeInTheDocument();
  });

  it("la configuración avisa de que los periodos cerrados conservan sus reglas", async () => {
    signedInAs(makeUser({ role: "super_admin", full_name: "Ana Admin" }));
    renderApp("/admin/settings");

    expect(await screen.findByRole("note")).toHaveTextContent(
      "Los periodos cerrados conservan sus reglas; los cambios solo afectan a los periodos abiertos que no se han cerrado nunca.",
    );
  });
});
