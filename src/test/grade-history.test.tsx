import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SemesterRead, SubjectRead } from "@/api/queries/admin";
import type { GradeChange } from "@/api/queries/grade-history";
import type { SubjectGrades, TeacherSubject } from "@/api/queries/teacher";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { personName } from "./handlers";
import { server } from "./server";

const s2026: SemesterRead = { id: 1, name: "2026-I", is_closed: false };
const mat: SubjectRead = { id: 10, code: "MAT-101", name: "Matemática I", semester: s2026 };
const maria = { id: 7, ...personName("María Pérez"), cedula_display: "V-28456123" };
const carlos = { id: 8, ...personName("Carlos Gómez"), cedula_display: "V-27118904" };

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

const changes: GradeChange[] = [
  {
    id: 3,
    student: maria,
    term: 1,
    evaluation_name: null,
    old_value: 15,
    new_value: 16,
    changed_by: "Pedro Profe",
    source: "manual",
    import_job_id: null,
    created_at: daysAgo(3),
    old_absent: false,
    new_absent: false,
  },
  {
    id: 2,
    student: carlos,
    term: 2,
    evaluation_name: null,
    old_value: null,
    new_value: 12.5,
    changed_by: "Pedro Profe",
    source: "import",
    import_job_id: "job-1",
    created_at: daysAgo(4),
    old_absent: false,
    new_absent: false,
  },
  {
    id: 1,
    student: maria,
    term: 3,
    evaluation_name: null,
    old_value: 9,
    new_value: null,
    changed_by: null,
    source: "manual",
    import_job_id: null,
    created_at: daysAgo(6),
    old_absent: false,
    new_absent: false,
  },
  {
    id: 0,
    student: carlos,
    term: 1,
    evaluation_name: "Parcial",
    old_value: 14,
    new_value: 1,
    changed_by: "Pedro Profe",
    source: "manual",
    import_job_id: null,
    created_at: daysAgo(8),
    old_absent: false,
    new_absent: true,
  },
];

/** Responde la página pedida y guarda los parámetros de cada consulta */
function historyHandler(path: string, seen: URLSearchParams[]) {
  return http.get(`${API_URL}${path}`, ({ request }) => {
    const params = new URL(request.url).searchParams;
    seen.push(params);
    const studentId = params.get("student_id");
    const items = studentId ? changes.filter((c) => c.student.id === Number(studentId)) : changes;
    return HttpResponse.json({
      items,
      total: items.length,
      limit: Number(params.get("limit")),
      offset: 0,
    });
  });
}

describe("profesor", () => {
  const secA = { id: 3, name: "A", semester_id: 1 };
  const subject: TeacherSubject = {
    ...mat,
    section: secA,
    students_count: 2,
    grades_count: { "1": 1, "2": 1, "3": 0 },
  };
  const data: SubjectGrades = {
    subject,
    section: secA,
    students: [
      {
        student: maria,
        grades: [
          { term: 1, value: 16, absent: false },
          { term: 2, value: null, absent: false },
          { term: 3, value: null, absent: false },
        ],
        average: 16,
        final_grade: null,
        passed: null,
      },
      {
        student: carlos,
        grades: [
          { term: 1, value: null, absent: false },
          { term: 2, value: 12.5, absent: false },
          { term: 3, value: null, absent: false },
        ],
        average: 12.5,
        final_grade: null,
        passed: null,
      },
    ],
  };
  const seen: URLSearchParams[] = [];

  beforeEach(() => {
    localStorage.clear();
    seen.length = 0;
    signedInAs(makeUser({ id: 5, role: "teacher", full_name: "Pedro Profe" }));
    server.use(
      http.get(`${API_URL}/teacher/subjects`, () => HttpResponse.json([subject])),
      http.get(`${API_URL}/teacher/subjects/10/sections/3/grades`, () => HttpResponse.json(data)),
      historyHandler("/teacher/subjects/10/sections/3/grade-history", seen),
    );
  });

  it("muestra el historial de la materia con cada cambio explicado", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10/3");

    await user.click(
      (await screen.findAllByRole("button", { name: "Historial" }))[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog", { name: "Historial de notas" });
    const list = await within(dialog).findByRole("list", { name: "Historial de notas" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(4);
    expect(items[0]).toHaveTextContent("María Pérez");
    expect(items[0]).toHaveTextContent("15.00 → 16.00");
    expect(items[0]).toHaveTextContent("Lapso 1 · Pedro Profe · hace 3 días · A mano");
    expect(items[1]).toHaveTextContent("Nota nueva: 12.50");
    expect(items[1]).toHaveTextContent("Importación");
    expect(items[2]).toHaveTextContent("Nota borrada: 9.00");
    expect(items[2]).toHaveTextContent("Usuario eliminado");
    expect(items[3]).toHaveTextContent("14.00 → Inasistente");
    expect(items[3]).toHaveTextContent("Parcial · Lapso 1");
    expect(seen[0]?.get("student_id")).toBeNull();
  });

  it("filtra el historial por estudiante desde su fila", async () => {
    const user = userEvent.setup();
    renderApp("/teacher/subjects/10/3");

    // Escritorio y móvil están en el DOM a la vez
    await user.click(
      (
        await screen.findAllByRole("button", { name: "Historial de Carlos Gómez" })
      )[0] as HTMLElement,
    );
    const dialog = await screen.findByRole("dialog", { name: "Historial de Carlos Gómez" });
    await waitFor(() => expect(within(dialog).getAllByRole("listitem")).toHaveLength(2));
    expect(within(dialog).getByText("Nota nueva: 12.50")).toBeInTheDocument();
    // Filtrado por estudiante: no repite su nombre en cada cambio
    expect(within(dialog).queryByText("Carlos Gómez")).not.toBeInTheDocument();
    expect(seen.at(-1)?.get("student_id")).toBe("8");

    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("coordinación", () => {
  const seen: URLSearchParams[] = [];

  beforeEach(() => {
    localStorage.clear();
    seen.length = 0;
    signedInAs(makeUser({ role: "coordinator", full_name: "Carmen Rojas" }));
    const student = (id: number, fullName: string) =>
      makeUser({ id, role: "student", full_name: fullName, email: null });
    server.use(
      http.get(`${API_URL}/subjects/10`, () => HttpResponse.json(mat)),
      http.get(`${API_URL}/subjects/10/teachers`, () => HttpResponse.json([])),
      http.get(`${API_URL}/subjects/10/students`, () =>
        HttpResponse.json([student(7, "María Pérez"), student(8, "Carlos Gómez")]),
      ),
      http.get(`${API_URL}/teachers`, () =>
        HttpResponse.json({ items: [], total: 0, limit: 100, offset: 0 }),
      ),
      historyHandler("/subjects/10/grade-history", seen),
    );
  });

  it("muestra el historial en el detalle de la materia y filtra por estudiante", async () => {
    const user = userEvent.setup();
    renderApp("/admin/academic/subjects/10");

    expect(await screen.findByRole("heading", { name: "Historial de notas" })).toBeInTheDocument();
    const list = await screen.findByRole("list", { name: "Historial de notas" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(4);

    await user.selectOptions(screen.getByLabelText("Filtrar el historial por estudiante"), "7");
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Historial de notas" })).getAllByRole("listitem"),
      ).toHaveLength(2),
    );
    expect(seen.at(-1)?.get("student_id")).toBe("7");
  });
});
