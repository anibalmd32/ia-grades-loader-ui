import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SemesterRead, SubjectRead } from "@/api/queries/admin";
import type { StudentOverview } from "@/api/queries/student";
import type { SubjectGrades, TeacherSubject } from "@/api/queries/teacher";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { personName } from "./handlers";
import { server } from "./server";

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

const open: SemesterRead = { id: 1, name: "2026-I", is_closed: false, subjects_count: 1 };
const closed: SemesterRead = {
  id: 2,
  name: "2025-II",
  is_closed: true,
  closed_at: "2026-02-01T12:00:00Z",
  subjects_count: 1,
};
const mat: SubjectRead = { id: 10, code: "MAT-101", name: "Matemática I", semester: open };
const his: SubjectRead = { id: 20, code: "HIS-100", name: "Historia", semester: closed };
const maria = { id: 7, ...personName("María Pérez"), cedula_display: "V-28456123" };
const student = makeUser({
  id: 7,
  role: "student",
  full_name: "María Pérez",
  email: null,
  nationality: "V",
  cedula: 28456123,
  cedula_display: "V-28456123",
});

describe("coordinación", () => {
  beforeEach(() => {
    localStorage.clear();
    signedInAs(makeUser({ role: "coordinator", full_name: "Carmen Rojas" }));
    server.use(
      http.get(`${API_URL}/semesters`, () => HttpResponse.json([open, closed])),
      http.get(`${API_URL}/subjects`, () => HttpResponse.json(page([mat, his]))),
      http.get(`${API_URL}/teachers`, () => HttpResponse.json(page([]))),
      http.get(`${API_URL}/students`, () => HttpResponse.json(page([student]))),
    );
  });

  it("marca los periodos cerrados y cierra uno abierto tras explicar qué se bloquea", async () => {
    let closedId: string | undefined;
    server.use(
      http.post(`${API_URL}/semesters/:id/close`, ({ params }) => {
        closedId = String(params.id);
        return HttpResponse.json({ ...open, is_closed: true });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    const list = (await screen.findByRole("button", { name: "Renombrar 2025-II" })).closest("ul");
    if (!list) throw new Error("sin lista");
    expect(within(list).getAllByText("Cerrado")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Reabrir 2025-II" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cerrar 2026-I" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("¿Cerrar el semestre 2026-I?");
    expect(dialog).toHaveTextContent(/notas.*matrículas.*materias/);
    expect(dialog).toHaveTextContent(/reglas de evaluación quedarán congeladas/);
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(closedId).toBe("1"));
    expect(await screen.findByText("Semestre 2026-I cerrado.")).toBeInTheDocument();
  });

  it("reabre un periodo cerrado", async () => {
    let reopened = false;
    server.use(
      http.post(`${API_URL}/semesters/2/reopen`, () => {
        reopened = true;
        return HttpResponse.json({ ...closed, is_closed: false, closed_at: null });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    await user.click(await screen.findByRole("button", { name: "Reabrir 2025-II" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Reabrir" }),
    );
    await waitFor(() => expect(reopened).toBe(true));
    expect(await screen.findByText("Semestre 2025-II reabierto.")).toBeInTheDocument();
  });

  it("en una materia de un periodo cerrado no deja matricular ni retirar", async () => {
    server.use(
      http.get(`${API_URL}/subjects/20`, () => HttpResponse.json(his)),
      http.get(`${API_URL}/subjects/20/teachers`, () => HttpResponse.json([])),
      http.get(`${API_URL}/subjects/20/students`, () => HttpResponse.json([student])),
    );
    renderApp("/admin/academic/subjects/20");

    expect(
      await screen.findByText(/El semestre 2025-II está cerrado: no se pueden matricular/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Matricular estudiantes" })).toBeDisabled();
    for (const button of await screen.findAllByRole("button", { name: /^Quitar/ })) {
      expect(button).toBeDisabled();
    }
  });

  it("en el estudiante, las materias de periodos cerrados no se pueden elegir ni quitar", async () => {
    server.use(
      http.get(`${API_URL}/students/7`, () => HttpResponse.json(student)),
      http.get(`${API_URL}/students/7/subjects`, () => HttpResponse.json([his])),
    );
    renderApp("/admin/students/7");

    const select = await screen.findByLabelText("Materia a matricular");
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(2));
    for (const button of await screen.findAllByRole("button", { name: "Quitar" })) {
      expect(button).toBeDisabled();
    }
    expect(screen.getAllByText("Cerrado").length).toBeGreaterThan(0);
  });
});

describe("profesor", () => {
  const closedSubject: TeacherSubject = {
    ...his,
    students_count: 1,
    grades_count: { "1": 1, "2": 1, "3": 1 },
  };
  const openSubject: TeacherSubject = {
    ...mat,
    students_count: 1,
    grades_count: { "1": 0, "2": 0, "3": 0 },
  };
  const data: SubjectGrades = {
    subject: his,
    students: [
      {
        student: maria,
        grades: [
          { term: 1, value: 15 },
          { term: 2, value: 16 },
          { term: 3, value: 17 },
        ],
        average: 16,
        final_grade: 16,
        passed: true,
      },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    signedInAs(makeUser({ id: 5, role: "teacher", full_name: "José Méndez" }));
    server.use(
      http.get(`${API_URL}/teacher/subjects`, () =>
        HttpResponse.json([openSubject, closedSubject]),
      ),
      http.get(`${API_URL}/teacher/subjects/20/grades`, () => HttpResponse.json(data)),
      http.get(`${API_URL}/teacher/import-jobs`, () => HttpResponse.json([])),
    );
  });

  it("la tarjeta de una materia cerrada solo permite ver las notas", async () => {
    renderApp("/teacher/subjects");

    const card = (await screen.findByRole("heading", { name: "Historia" })).closest("article");
    if (!card) throw new Error("sin tarjeta");
    expect(within(card).getByText("Cerrado")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Ver notas" })).toBeInTheDocument();
    expect(within(card).queryByRole("link", { name: "Importar Excel" })).not.toBeInTheDocument();
  });

  it("la planilla de un periodo cerrado es de solo lectura", async () => {
    renderApp("/teacher/subjects/20");

    expect(
      await screen.findByText(/El semestre 2025-II está cerrado: sus notas ya no se pueden/),
    ).toBeInTheDocument();
    for (const input of screen.getAllByLabelText(/María Pérez · Lapso/)) {
      expect(input).toBeDisabled();
    }
    expect(screen.queryByRole("button", { name: /Guardar cambios/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Importar Excel" })).not.toBeInTheDocument();
  });

  it("no ofrece importar notas en materias de periodos cerrados", async () => {
    renderApp("/teacher/imports?subject=20");

    const select = await screen.findByRole("combobox", { name: /Materia/ });
    const option = await within(select).findByRole("option", { name: /HIS-100/ });
    expect(option).toBeDisabled();
    expect(option).toHaveTextContent("(semestre cerrado)");
    expect(await screen.findByText(/HIS-100 es de un semestre cerrado/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir y procesar" })).toBeDisabled();
  });
});

describe("estudiante", () => {
  it("marca como cerrado el periodo que está viendo", async () => {
    localStorage.clear();
    signedInAs(student);
    const overview: StudentOverview = {
      subjects: [
        {
          subject: his,
          teachers: [],
          grades: [
            { term: 1, value: 15 },
            { term: 2, value: 16 },
            { term: 3, value: 17 },
          ],
          average: 16,
          projection: {
            standing: "passed",
            final_grade: 16,
            pending_terms: [],
            needed_average: null,
          },
        },
      ],
      average: 16,
      semesters: [
        { semester: closed, average: 16, subjects_count: 1, passed_count: 1, failed_count: 0 },
      ],
    };
    server.use(http.get(`${API_URL}/student/subjects`, () => HttpResponse.json(overview)));
    renderApp("/student/grades");

    expect(await screen.findByText("Semestre 2025-II")).toBeInTheDocument();
    expect(screen.getByText("Cerrado")).toBeInTheDocument();
  });
});
