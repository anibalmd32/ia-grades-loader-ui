import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { EvaluationPlan, TermEvaluationGrades } from "@/api/queries/evaluations";
import type { StudentSubjectGrades } from "@/api/queries/student";
import type { SubjectGrades, TeacherSubject } from "@/api/queries/teacher";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { personName } from "./handlers";
import { server } from "./server";

const s2026 = { id: 1, name: "2026-I", is_closed: false };
const mat: TeacherSubject = {
  id: 10,
  code: "MAT-101",
  name: "Matemática I",
  semester: s2026,
  students_count: 2,
  grades_count: { "1": 2, "2": 0, "3": 0 },
};
const maria = { id: 7, ...personName("María Pérez"), cedula_display: "V-28456123" };
const carlos = { id: 8, ...personName("Carlos Gómez"), cedula_display: "V-27118904" };

const parcial = {
  id: 1,
  term: 1,
  name: "Parcial",
  weight: 40,
  due_date: "2026-11-02",
  graded_count: 2,
};
const taller = { id: 2, term: 1, name: "Taller", weight: 60, due_date: null, graded_count: 1 };
const plan: EvaluationPlan = {
  subject: mat,
  terms: [
    { term: 1, weights_total: 100, evaluations_count: 2, complete: true },
    { term: 2, weights_total: 0, evaluations_count: 0, complete: false },
    { term: 3, weights_total: 0, evaluations_count: 0, complete: false },
  ],
  evaluations: [parcial, taller],
};
const sheet: TermEvaluationGrades = {
  subject: mat,
  plan: plan.terms[0] as EvaluationPlan["terms"][number],
  evaluations: [parcial, taller],
  students: [
    {
      student: maria,
      grades: [
        { evaluation_id: 1, value: 15 },
        { evaluation_id: 2, value: 18.5 },
      ],
      accumulated: 17.1,
      term_grade: 17.1,
    },
    {
      student: carlos,
      grades: [
        { evaluation_id: 1, value: 8 },
        { evaluation_id: 2, value: null },
      ],
      accumulated: 3.2,
      term_grade: null,
    },
  ],
};
const gradebook: SubjectGrades = {
  subject: mat,
  computed_terms: [1],
  students: [
    {
      student: maria,
      grades: [
        { term: 1, value: 17.1 },
        { term: 2, value: null },
        { term: 3, value: null },
      ],
      average: 17.1,
      final_grade: null,
      passed: null,
    },
  ],
};

// Escritorio y móvil están en el DOM a la vez: la última celda es la de la tabla
const cell = async (label: string) =>
  (await screen.findAllByLabelText(label)).at(-1) as HTMLInputElement;

describe("profesor: plan de evaluación", () => {
  beforeEach(() => {
    localStorage.clear();
    signedInAs(makeUser({ id: 5, role: "teacher", full_name: "José Méndez" }));
    server.use(
      http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([mat])),
      http.get(`${API_URL}/teacher/subjects/10/grades`, () => HttpResponse.json(gradebook)),
      http.get(`${API_URL}/teacher/subjects/10/evaluations`, () => HttpResponse.json(plan)),
      http.get(`${API_URL}/teacher/subjects/10/terms/1/evaluation-grades`, () =>
        HttpResponse.json(sheet),
      ),
    );
  });

  it("en la planilla el lapso con evaluaciones no se edita y enlaza al plan", async () => {
    renderApp("/teacher/subjects/10");
    const computed = await cell("María Pérez · Lapso 1");
    expect(computed).toBeDisabled();
    expect(computed).toHaveValue("17.10");
    expect(await cell("María Pérez · Lapso 2")).toBeEnabled();
    expect(screen.getByText("Por evaluaciones")).toBeInTheDocument();
    // Las acciones de la cabecera se repiten en escritorio y móvil
    for (const link of screen.getAllByRole("link", { name: "Evaluaciones" })) {
      expect(link).toHaveAttribute("href", "/teacher/evaluations/10");
    }
  });

  it("muestra el plan del lapso y la nota calculada por la API", async () => {
    renderApp("/teacher/evaluations/10");

    expect(await screen.findByText("Parcial")).toBeInTheDocument();
    expect(screen.getByText(/El plan suma 100 %/)).toBeInTheDocument();
    expect(screen.getByText(/2 nov/)).toBeInTheDocument();
    expect(screen.getByText("1 calificado")).toBeInTheDocument();

    const table = await screen.findByRole("table");
    const carlosRow = within(table)
      .getByText(/Carlos Gómez/)
      .closest("tr") as HTMLElement;
    expect(within(carlosRow).getByText("3.20")).toBeInTheDocument();
    expect(within(carlosRow).getByText("Pendiente")).toBeInTheDocument();
    const mariaRow = within(table)
      .getByText(/María Pérez/)
      .closest("tr") as HTMLElement;
    expect(within(mariaRow).getAllByText("17.10")).toHaveLength(2);
  });

  it("un lapso sin evaluaciones explica la carga directa", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/evaluations/10");
    await user.click(await screen.findByRole("tab", { name: /Lapso 2/ }));
    expect(await screen.findByText(/se carga directamente en la planilla/)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("guarda las notas de las evaluaciones que cambian", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.put(`${API_URL}/teacher/subjects/10/terms/1/evaluation-grades`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(sheet);
      }),
    );
    renderApp("/teacher/evaluations/10");

    const input = await cell("Carlos Gómez · Taller");
    await user.type(input, "21");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Carlos Gómez · Taller: la nota debe estar entre 1 y 20",
    );
    expect(screen.getByRole("button", { name: /Guardar notas/ })).toBeDisabled();

    await user.clear(input);
    await user.type(input, "12,5");
    await user.click(screen.getByRole("button", { name: "Guardar notas (1)" }));
    await waitFor(() =>
      expect(body).toEqual({ grades: [{ student_id: 8, evaluation_id: 2, value: 12.5 }] }),
    );
    expect(await screen.findByText("1 nota guardada.")).toBeInTheDocument();
  });

  it("añade una evaluación con el porcentaje libre del lapso", async () => {
    const user = userEvent.setup();
    let body: unknown;
    server.use(
      http.post(`${API_URL}/teacher/subjects/10/evaluations`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...parcial, id: 3, term: 2 }, { status: 201 });
      }),
    );
    renderApp("/teacher/evaluations/10?term=2");

    await user.click(await screen.findByRole("button", { name: "Añadir evaluación" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva evaluación · Lapso 2" });
    expect(within(dialog).getByLabelText("Porcentaje del lapso")).toHaveValue("100");
    await user.type(within(dialog).getByLabelText("Nombre"), "Examen final");
    const weight = within(dialog).getByLabelText("Porcentaje del lapso");
    await user.clear(weight);
    await user.type(weight, "120");
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }));
    expect(await within(dialog).findByText("No puede pasar del 100 %")).toBeInTheDocument();

    await user.clear(weight);
    await user.type(weight, "50");
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }));
    await waitFor(() =>
      expect(body).toEqual({ term: 2, name: "Examen final", weight: 50, due_date: null }),
    );
    expect(await screen.findByText("Evaluación añadida.")).toBeInTheDocument();
  });

  it("muestra el error de la API al crear la primera evaluación de un lapso con notas", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${API_URL}/teacher/subjects/10/evaluations`, () =>
        HttpResponse.json(
          { detail: "El lapso 2 ya tiene 3 notas cargadas directamente." },
          { status: 409 },
        ),
      ),
    );
    renderApp("/teacher/evaluations/10?term=2");
    await user.click(await screen.findByRole("button", { name: "Añadir evaluación" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Nombre"), "Examen");
    await user.click(within(dialog).getByRole("button", { name: "Añadir" }));
    expect(await within(dialog).findByText(/ya tiene 3 notas cargadas/)).toBeInTheDocument();
  });

  it("edita y elimina evaluaciones (con confirmación)", async () => {
    const user = userEvent.setup();
    let patched: unknown;
    let deleted = false;
    server.use(
      http.patch(`${API_URL}/teacher/subjects/10/evaluations/2`, async ({ request }) => {
        patched = await request.json();
        return HttpResponse.json(taller);
      }),
      http.delete(`${API_URL}/teacher/subjects/10/evaluations/1`, () => {
        deleted = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/teacher/evaluations/10");

    await user.click(await screen.findByRole("button", { name: "Editar Taller" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar «Taller»" });
    expect(within(dialog).getByText("Quedan 60 % libres en el lapso 1")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Fecha (opcional)"), "2026-12-01");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));
    await waitFor(() =>
      expect(patched).toEqual({ name: "Taller", weight: 60, due_date: "2026-12-01" }),
    );

    await user.click(screen.getByRole("button", { name: "Eliminar Parcial" }));
    const confirmDialog = (await screen.findByText("¿Eliminar «Parcial»?")).closest(
      '[role="dialog"]',
    ) as HTMLElement;
    expect(confirmDialog).toHaveTextContent("Se borrarán también sus 2 notas");
    await user.click(within(confirmDialog).getByRole("button", { name: "Eliminar" }));
    await waitFor(() => expect(deleted).toBe(true));
  });

  it("en un periodo cerrado el plan es de solo lectura", async () => {
    const closed = { ...mat, semester: { ...s2026, is_closed: true } };
    server.use(
      http.get(`${API_URL}/teacher/subjects/10/evaluations`, () =>
        HttpResponse.json({ ...plan, subject: closed }),
      ),
    );
    renderApp("/teacher/evaluations/10");
    expect(await screen.findByText(/está cerrado/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Añadir evaluación" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Taller" })).not.toBeInTheDocument();
    expect(await cell("María Pérez · Parcial")).toBeDisabled();
  });
});

describe("estudiante: plan de evaluación", () => {
  it("ve las evaluaciones de cada lapso con su nota", async () => {
    signedInAs(makeUser({ id: 7, role: "student", full_name: "María Pérez" }));
    const detail: StudentSubjectGrades = {
      subject: mat,
      teachers: ["José Méndez"],
      grades: [
        { term: 1, value: 17.1 },
        { term: 2, value: null },
        { term: 3, value: null },
      ],
      evaluations: [
        { term: 1, name: "Parcial", weight: 40, due_date: "2026-11-02", value: 15 },
        { term: 1, name: "Taller", weight: 60, due_date: null, value: null },
      ],
      average: 17.1,
      projection: {
        standing: "in_progress",
        final_grade: null,
        pending_terms: [2, 3],
        needed_average: 6.45,
      },
    };
    server.use(http.get(`${API_URL}/student/subjects/10`, () => HttpResponse.json(detail)));
    renderApp("/student/grades/10");

    const section = (await screen.findByRole("heading", { name: "Plan de evaluación" })).closest(
      "section",
    ) as HTMLElement;
    expect(within(section).getByText("Parcial")).toBeInTheDocument();
    expect(within(section).getByText("40 %")).toBeInTheDocument();
    expect(within(section).getByText("15.00")).toBeInTheDocument();
    expect(within(section).getByText("Pendiente")).toBeInTheDocument();
    expect(within(section).getByText("2 nov")).toBeInTheDocument();
  });
});
