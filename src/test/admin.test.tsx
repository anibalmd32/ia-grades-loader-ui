import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SectionRead, SemesterRead, SubjectRead, UserRead } from "@/api/queries/admin";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

const s2026: SemesterRead = { id: 1, name: "2026-I", is_closed: false };
const s2025: SemesterRead = { id: 2, name: "2025-II", is_closed: false };
const mat: SubjectRead = { id: 10, code: "MAT-101", name: "Matemática I", semester: s2026 };
const fis: SubjectRead = { id: 11, code: "FIS-101", name: "Física I", semester: s2026 };
const secA: SectionRead = { id: 20, name: "A", semester_id: 1, students_count: 2 };
const secB: SectionRead = { id: 21, name: "B", semester_id: 1, students_count: 0 };
// Profesor de cada sección: MAT-101 lo tiene en la A; FIS-101 en ninguna
const sectionTeachersMat = [
  { section_id: 20, section_name: "A", teacher_id: 5, teacher_name: "José Méndez" },
  { section_id: 21, section_name: "B", teacher_id: 5, teacher_name: "José Méndez" },
];
const sectionTeachersFis = [
  { section_id: 20, section_name: "A", teacher_id: null, teacher_name: null },
  { section_id: 21, section_name: "B", teacher_id: 5, teacher_name: "José Méndez" },
];

const teacher = makeUser({
  id: 5,
  role: "teacher",
  full_name: "José Méndez",
  email: "jose@uni.edu",
});
const student = makeUser({
  id: 7,
  role: "student",
  full_name: "María Pérez",
  email: null,
  nationality: "V",
  cedula: 28456123,
  cedula_display: "V-28456123",
});

beforeEach(() => {
  localStorage.clear();
  signedInAs(makeUser({ role: "super_admin", full_name: "Admin" }));
  server.use(
    http.get(`${API_URL}/semesters`, () => HttpResponse.json([s2026, s2025])),
    http.get(`${API_URL}/subjects`, () => HttpResponse.json(page([mat, fis]))),
    http.get(`${API_URL}/teachers`, () => HttpResponse.json(page([teacher]))),
    http.get(`${API_URL}/students`, () => HttpResponse.json(page([student]))),
    // Secciones: el 2026-I tiene A y B; el 2025-II ninguna
    http.get(`${API_URL}/semesters/:id/sections`, ({ params }) =>
      HttpResponse.json(params.id === "1" ? [secA, secB] : []),
    ),
    http.get(`${API_URL}/students/:id/sections`, () =>
      HttpResponse.json([{ ...secA, semester: s2026 }]),
    ),
  );
});

describe("cuentas", () => {
  it("lista con filtro de estado enviado a la API", async () => {
    const queries: string[] = [];
    server.use(
      http.get(`${API_URL}/coordinators`, ({ request }) => {
        queries.push(new URL(request.url).search);
        return HttpResponse.json(page([makeUser({ id: 3, full_name: "Carmen Rojas" })]));
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/coordinators");

    expect((await screen.findAllByText("Carmen Rojas")).length).toBeGreaterThan(0);
    expect(queries[0]).toContain("is_active=true");

    await user.selectOptions(screen.getByLabelText("Filtrar por estado"), "all");
    await waitFor(() => expect(queries.at(-1)).not.toContain("is_active"));
  });

  it("crea un profesor y muestra la contraseña generada una vez", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/teachers`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            user: { ...teacher, id: 9, full_name: "Ramón Díaz", email: "ramon@uni.edu" },
            generated_password: "k7Q2-mXp9",
          },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/admin/teachers/new");

    await user.type(await screen.findByLabelText("Nombre"), "Ramón");
    await user.type(screen.getByLabelText("Apellido"), "Díaz");
    await user.type(screen.getByLabelText("Email"), "ramon@uni.edu");
    await user.click(screen.getByRole("button", { name: "Crear profesor" }));

    const dialog = await screen.findByRole("dialog", { name: "Contraseña generada" });
    expect(within(dialog).getByTestId("generated-password")).toHaveTextContent("k7Q2-mXp9");
    expect(within(dialog).getByText("Ramón Díaz · ramon@uni.edu")).toBeInTheDocument();
    expect(body).toEqual({ first_name: "Ramón", last_name: "Díaz", email: "ramon@uni.edu" });
    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/teachers"));

    await user.click(within(dialog).getByRole("button", { name: "Entendido" }));
    expect(screen.queryByRole("dialog", { name: "Contraseña generada" })).not.toBeInTheDocument();
  });

  it("muestra el error de email duplicado en su campo (422)", async () => {
    server.use(
      http.post(`${API_URL}/teachers`, () =>
        HttpResponse.json(
          {
            detail: [
              { loc: ["body", "email"], msg: "Ya existe un usuario con ese email", type: "x" },
            ],
          },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/teachers/new");

    await user.type(await screen.findByLabelText("Nombre"), "Ramón");
    await user.type(screen.getByLabelText("Apellido"), "Díaz");
    await user.type(screen.getByLabelText("Email"), "jose@uni.edu");
    await user.click(screen.getByRole("button", { name: "Crear profesor" }));

    expect(await screen.findByText("Ya existe un usuario con ese email")).toBeInTheDocument();
  });

  it("desactiva una cuenta tras confirmar", async () => {
    let patch: unknown;
    server.use(
      http.get(`${API_URL}/teachers/5`, () => HttpResponse.json(teacher)),
      http.get(`${API_URL}/teachers/5/subjects`, () => HttpResponse.json([])),
      http.patch(`${API_URL}/teachers/5`, async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json({ ...teacher, is_active: false });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/teachers/5");

    await user.click(await screen.findByRole("button", { name: "Desactivar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Desactivar" }));

    await waitFor(() => expect(patch).toEqual({ is_active: false }));
    expect(await screen.findByText("Cuenta desactivada.")).toBeInTheDocument();
  });

  it("restablece la contraseña y la muestra", async () => {
    server.use(
      http.get(`${API_URL}/coordinators/3`, () =>
        HttpResponse.json(makeUser({ id: 3, full_name: "Carmen Rojas" })),
      ),
      http.post(`${API_URL}/coordinators/3/reset-password`, () =>
        HttpResponse.json({ generated_password: "Nueva-123" }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/coordinators/3");

    await user.click(await screen.findByRole("button", { name: "Restablecer contraseña" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Restablecer" }),
    );

    expect(await screen.findByTestId("generated-password")).toHaveTextContent("Nueva-123");
  });

  it("asigna materias a un profesor por sección (reemplaza el conjunto)", async () => {
    let put: unknown;
    server.use(
      http.get(`${API_URL}/teachers/5`, () => HttpResponse.json(teacher)),
      http.get(`${API_URL}/teachers/5/subjects`, () =>
        HttpResponse.json([{ subject: mat, section: secA }]),
      ),
      http.put(`${API_URL}/teachers/5/subjects`, async ({ request }) => {
        put = await request.json();
        return HttpResponse.json([
          { subject: mat, section: secA },
          { subject: fis, section: secB },
        ]);
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/teachers/5");

    const fisB = await screen.findByRole("checkbox", { name: "FIS-101 Física I · Sección B" });
    expect(
      screen.getByRole("checkbox", { name: "MAT-101 Matemática I · Sección A" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "MAT-101 Matemática I · Sección B" }),
    ).not.toBeChecked();
    await user.click(fisB);
    await user.click(screen.getByRole("button", { name: "Guardar asignación" }));

    await waitFor(() =>
      expect(put).toEqual({
        assignments: [
          { subject_id: 10, section_id: 20 },
          { subject_id: 11, section_id: 21 },
        ],
      }),
    );
  });

  it("explica que la sección ya tiene profesor (409)", async () => {
    const detail =
      "Cada materia tiene un solo profesor por sección y ya están asignadas: MAT-101 sección B: Laura Profe";
    server.use(
      http.get(`${API_URL}/teachers/5`, () => HttpResponse.json(teacher)),
      http.get(`${API_URL}/teachers/5/subjects`, () => HttpResponse.json([])),
      http.put(`${API_URL}/teachers/5/subjects`, () =>
        HttpResponse.json({ detail }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/teachers/5");

    await user.click(
      await screen.findByRole("checkbox", { name: "MAT-101 Matemática I · Sección B" }),
    );
    await user.click(screen.getByRole("button", { name: "Guardar asignación" }));

    expect(await screen.findByText(detail)).toBeInTheDocument();
  });
});

describe("estudiantes", () => {
  it("crea un estudiante con cédula y lo matricula en las materias marcadas", async () => {
    let created: unknown;
    let sectioned: unknown;
    let enrolled: unknown;
    server.use(
      http.post(`${API_URL}/students`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({ user: student, generated_password: "Est-1" }, { status: 201 });
      }),
      http.post(`${API_URL}/sections/20/students`, async ({ request }) => {
        sectioned = await request.json();
        return HttpResponse.json({ added: 1, moved: 0, already_in_section: 0 });
      }),
      http.post(`${API_URL}/students/7/subjects`, async ({ request }) => {
        enrolled = await request.json();
        return HttpResponse.json({ added: 1, already_enrolled: 0 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/students/new");

    await user.type(await screen.findByLabelText("Nombre"), "  María ");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Número de cédula"), "28456123");
    await user.click(await screen.findByRole("checkbox", { name: "MAT-101 Matemática I" }));
    // Sin sección no se matricula: la pide antes de crear
    await user.click(screen.getByRole("button", { name: "Crear estudiante" }));
    expect(
      await screen.findByText("Elige la sección del semestre 2026-I para matricularlo."),
    ).toBeInTheDocument();
    const section = screen.getByLabelText("Sección en semestre 2026-I");
    await within(section).findByRole("option", { name: "Sección A" });
    await user.selectOptions(section, "20");
    await user.click(screen.getByRole("button", { name: "Crear estudiante" }));

    expect(await screen.findByTestId("generated-password")).toHaveTextContent("Est-1");
    // Nombre y apellido por separado, sin espacios de sobra
    expect(created).toEqual({
      first_name: "María",
      last_name: "Pérez",
      nationality: "V",
      cedula: 28456123,
    });
    expect(sectioned).toEqual({ student_ids: [7] });
    expect(enrolled).toEqual({ subject_ids: [10] });
  });

  it("elige materias de varios semestres con el selector y las resume todas", async () => {
    const qui: SubjectRead = { id: 20, code: "QUI-101", name: "Química", semester: s2025 };
    const closed: SemesterRead = { id: 3, name: "2025-I", is_closed: true };
    const old: SubjectRead = { id: 30, code: "LEN-101", name: "Lenguaje", semester: closed };
    let enrolled: unknown;
    server.use(
      http.get(`${API_URL}/subjects`, () => HttpResponse.json(page([mat, fis, qui, old]))),
      http.post(`${API_URL}/students`, () =>
        HttpResponse.json({ user: student, generated_password: "Est-1" }, { status: 201 }),
      ),
      http.get(`${API_URL}/semesters/2/sections`, () =>
        HttpResponse.json([{ id: 40, name: "A", semester_id: 2, students_count: 0 }]),
      ),
      http.post(`${API_URL}/sections/40/students`, () =>
        HttpResponse.json({ added: 1, moved: 0, already_in_section: 0 }),
      ),
      http.post(`${API_URL}/students/7/subjects`, async ({ request }) => {
        enrolled = await request.json();
        return HttpResponse.json({ added: 2, already_enrolled: 0 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/students/new");

    const period = await screen.findByLabelText("Semestre");
    expect(period).toHaveValue("1");
    const summary = screen.getByRole("region", { name: "Materias seleccionadas" });
    expect(summary).toHaveTextContent("Aún no has elegido ninguna materia.");

    // Solo se ven las materias del semestre elegido
    await user.click(screen.getByRole("checkbox", { name: "MAT-101 Matemática I" }));
    expect(screen.queryByRole("checkbox", { name: "QUI-101 Química" })).not.toBeInTheDocument();
    await user.selectOptions(period, "2");
    expect(
      screen.queryByRole("checkbox", { name: "MAT-101 Matemática I" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "QUI-101 Química" }));
    await user.click(screen.getByRole("checkbox", { name: "QUI-101 Química" }));
    await user.click(screen.getByRole("checkbox", { name: "QUI-101 Química" }));

    // El resumen conserva las de los dos semestres y el selector cuenta las elegidas
    expect(within(summary).getByText("MAT-101 Matemática I")).toBeInTheDocument();
    expect(within(summary).getByText("QUI-101 Química")).toBeInTheDocument();
    expect(summary).toHaveTextContent("Materias seleccionadas (2)");
    expect(within(period).getByRole("option", { name: "2026-I · 1 elegida" })).toBeInTheDocument();

    // Los semestres cerrados se ven pero no admiten matrículas
    await user.selectOptions(period, "3");
    expect(screen.getByRole("checkbox", { name: "LEN-101 Lenguaje" })).toBeDisabled();

    // Quitar desde el resumen
    await user.click(within(summary).getByRole("button", { name: "Quitar MAT-101 Matemática I" }));
    expect(summary).toHaveTextContent("Materias seleccionadas (1)");

    await user.type(screen.getByLabelText("Nombre"), "María");
    await user.type(screen.getByLabelText("Apellido"), "Pérez");
    await user.type(screen.getByLabelText("Número de cédula"), "28456123");
    const section = screen.getByLabelText("Sección en semestre 2025-II");
    await within(section).findByRole("option", { name: "Sección A" });
    await user.selectOptions(section, "40");
    await user.click(screen.getByRole("button", { name: "Crear estudiante" }));
    await waitFor(() => expect(enrolled).toEqual({ subject_ids: [20] }));
  });

  it("muestra el error al retirar una matrícula con notas (409)", async () => {
    server.use(
      http.get(`${API_URL}/students/7`, () => HttpResponse.json(student)),
      http.get(`${API_URL}/students/7/subjects`, () => HttpResponse.json([mat])),
      http.delete(`${API_URL}/students/7/subjects/10`, () =>
        HttpResponse.json(
          { detail: "El estudiante ya tiene notas en esta materia" },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/students/7");

    const [withdraw] = await screen.findAllByRole("button", { name: "Quitar" });
    await user.click(withdraw);
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Quitar" }),
    );

    expect(
      await screen.findByText("El estudiante ya tiene notas en esta materia"),
    ).toBeInTheDocument();
  });

  it("asigna la sección del estudiante y solo matricula donde la tiene", async () => {
    let assigned: unknown;
    const qui: SubjectRead = { id: 12, code: "QUI-101", name: "Química", semester: s2025 };
    server.use(
      http.get(`${API_URL}/students/7`, () => HttpResponse.json(student)),
      http.get(`${API_URL}/students/7/subjects`, () => HttpResponse.json([])),
      http.get(`${API_URL}/subjects`, () => HttpResponse.json(page([mat, qui]))),
      http.post(`${API_URL}/sections/21/students`, async ({ request }) => {
        assigned = await request.json();
        return HttpResponse.json({ added: 0, moved: 1, already_in_section: 0 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/students/7");

    const select = await screen.findByLabelText("Sección en semestre 2026-I");
    await waitFor(() => expect(select).toHaveValue("20"));
    await user.selectOptions(select, "21");
    await waitFor(() => expect(assigned).toEqual({ student_ids: [7] }));

    // Sin sección en 2025-II sus materias no se ofrecen para matricular
    const subjects = screen.getByLabelText("Materia a matricular");
    expect(within(subjects).getByRole("option", { name: /QUI-101.*sin sección/ })).toBeDisabled();
    expect(
      within(subjects).getByRole("option", { name: "MAT-101 Matemática I · 2026-I" }),
    ).toBeEnabled();
  });
});

describe("recuentos de la API en los listados", () => {
  it("muestra las materias de cada profesor", async () => {
    server.use(
      http.get(`${API_URL}/teachers`, () =>
        HttpResponse.json(
          page([
            { ...teacher, subjects_count: 3 },
            { ...teacher, id: 6, full_name: "Ramón Díaz", subjects_count: 0 },
          ]),
        ),
      ),
    );
    renderApp("/admin/teachers");

    expect((await screen.findAllByText(/3 materias/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sin materias/).length).toBeGreaterThan(0);
  });

  it("muestra el profesor de cada sección y el resumen del periodo", async () => {
    server.use(
      http.get(`${API_URL}/subjects`, () =>
        HttpResponse.json(
          page([
            { ...mat, teachers_count: 1, students_count: 42, section_teachers: sectionTeachersMat },
            { ...fis, teachers_count: 0, students_count: 38, section_teachers: sectionTeachersFis },
          ]),
        ),
      ),
    );
    renderApp("/admin/academic");

    expect(await screen.findByText("2 materias · 2 secciones · 2 estudiantes")).toBeInTheDocument();
    expect(screen.getAllByText("José Méndez").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Sin profesor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("42").length).toBeGreaterThan(0);
  });
});

describe("periodo escolar", () => {
  it("muestra las materias del primer periodo, cambia de periodo y crea uno", async () => {
    let semesterQuery = "";
    let createdName: unknown;
    server.use(
      http.get(`${API_URL}/subjects`, ({ request }) => {
        semesterQuery = new URL(request.url).searchParams.get("semester_id") ?? "";
        return HttpResponse.json(page(semesterQuery === "1" ? [mat, fis] : []));
      }),
      http.post(`${API_URL}/semesters`, async ({ request }) => {
        createdName = await request.json();
        return HttpResponse.json({ id: 3, name: "2027-I", is_closed: false }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    expect((await screen.findAllByText("Matemática I")).length).toBeGreaterThan(0);
    expect(semesterQuery).toBe("1");

    await user.selectOptions(screen.getByLabelText("Semestre"), "2");
    expect(await screen.findByText("Este semestre no tiene materias")).toBeInTheDocument();
    expect(semesterQuery).toBe("2");

    const [newPeriod] = screen.getAllByRole("button", { name: "Nuevo semestre" });
    if (!newPeriod) throw new Error("sin botón");
    await user.click(newPeriod);
    const dialog = await screen.findByRole("dialog", { name: "Nuevo semestre" });
    await user.type(within(dialog).getByLabelText("Nombre"), "2027-I");
    await user.click(within(dialog).getByRole("button", { name: "Crear semestre" }));
    await waitFor(() => expect(createdName).toEqual({ name: "2027-I" }));
  });

  it("no elimina un periodo con materias y lo explica", async () => {
    server.use(
      http.delete(`${API_URL}/semesters/1`, () =>
        HttpResponse.json({ detail: "El semestre tiene materias" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    await user.click(await screen.findByRole("button", { name: "Más acciones de 2026-I" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar" }),
    );

    expect(await screen.findByText("El semestre tiene materias")).toBeInTheDocument();
  });

  it("crea una materia", async () => {
    let subjectBody: unknown;
    server.use(
      http.post(`${API_URL}/subjects`, async ({ request }) => {
        subjectBody = await request.json();
        return HttpResponse.json(
          { id: 12, code: "QUI-101", name: "Química I", semester: s2026 },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/admin/academic/new?semester=1");

    await user.type(await screen.findByLabelText("Código"), "QUI-101");
    await user.type(screen.getByLabelText("Nombre"), "Química I");
    await user.click(screen.getByRole("button", { name: "Crear materia" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/academic"));
    expect(subjectBody).toEqual({ semester_id: 1, code: "QUI-101", name: "Química I" });
  });

  it("en la pestaña Secciones avisa de las materias sin profesor y crea, renombra y elimina", async () => {
    let created: unknown;
    let renamed: unknown;
    server.use(
      http.get(`${API_URL}/subjects`, () =>
        HttpResponse.json(
          page([
            { ...mat, section_teachers: sectionTeachersMat },
            { ...fis, section_teachers: sectionTeachersFis },
          ]),
        ),
      ),
      http.post(`${API_URL}/semesters/1/sections`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json(
          { id: 22, name: "C", semester_id: 1, students_count: 0 },
          { status: 201 },
        );
      }),
      http.patch(`${API_URL}/sections/21`, async ({ request }) => {
        renamed = await request.json();
        return HttpResponse.json({ ...secB, name: "D" });
      }),
      http.delete(`${API_URL}/sections/20`, () =>
        HttpResponse.json(
          { detail: "No se puede eliminar una sección con estudiantes asignados" },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    await user.click(await screen.findByRole("tab", { name: "Secciones" }));
    const list = await screen.findByRole("list", { name: "Secciones de 2026-I" });
    const cards = within(list).getAllByRole("listitem");
    const cardA = cards.find((c) => within(c).queryByText("Sección A"));
    if (!cardA) throw new Error("sin tarjeta A");
    expect(within(cardA).getByText("2 estudiantes")).toBeInTheDocument();
    expect(within(cardA).getByText("1/2 materias con profesor")).toBeInTheDocument();
    expect(within(cardA).getByText("Sin profesor: FIS-101")).toBeInTheDocument();

    await user.click(within(list).getByRole("button", { name: "Nueva sección" }));
    const dialog = await screen.findByRole("dialog", { name: "Nueva sección · 2026-I" });
    await user.type(within(dialog).getByLabelText("Nombre de la sección"), "C");
    await user.click(within(dialog).getByRole("button", { name: "Crear sección" }));
    await waitFor(() => expect(created).toEqual({ name: "C" }));

    await user.click(screen.getByRole("button", { name: "Más acciones de la sección B" }));
    const cardB = cards.find((c) => within(c).queryByText("Sección B"));
    if (!cardB) throw new Error("sin tarjeta B");
    await user.click(within(cardB).getByRole("button", { name: "Renombrar" }));
    const rename = await screen.findByRole("dialog", { name: "Renombrar sección" });
    const input = within(rename).getByLabelText("Nombre");
    await user.clear(input);
    await user.type(input, "D");
    await user.click(within(rename).getByRole("button", { name: "Guardar" }));
    await waitFor(() => expect(renamed).toEqual({ name: "D" }));

    await user.click(within(cardA).getByRole("button", { name: "Eliminar" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar" }),
    );
    expect(
      await screen.findByText("No se puede eliminar una sección con estudiantes asignados"),
    ).toBeInTheDocument();
  });

  it("muestra, quita y añade estudiantes de una sección", async () => {
    let removed: string | undefined;
    let added: unknown;
    server.use(
      http.get(`${API_URL}/sections/20/students`, () => HttpResponse.json([student])),
      http.delete(`${API_URL}/sections/20/students/:id`, ({ params }) => {
        removed = String(params.id);
        return new HttpResponse(null, { status: 204 });
      }),
      http.get(`${API_URL}/sections/21/students`, () => HttpResponse.json([])),
      http.post(`${API_URL}/sections/21/students`, async ({ request }) => {
        added = await request.json();
        return HttpResponse.json({ added: 0, moved: 1, already_in_section: 0 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic?tab=secciones");

    const list = await screen.findByRole("list", { name: "Secciones de 2026-I" });
    const [buttonA, buttonB] = within(list).getAllByRole("button", { name: "Ver estudiantes" });
    if (!buttonA || !buttonB) throw new Error("faltan botones");

    await user.click(buttonA);
    let dialog = await screen.findByRole("dialog", { name: "Sección A · estudiantes" });
    expect(await within(dialog).findByText("María Pérez")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Quitar a María Pérez" }));
    await waitFor(() => expect(removed).toBe("7"));
    await user.click(within(dialog).getByRole("button", { name: "Cerrar" }));

    await user.click(buttonB);
    dialog = await screen.findByRole("dialog", { name: "Sección B · estudiantes" });
    expect(
      await within(dialog).findByText("Aún no hay estudiantes en esta sección."),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByPlaceholderText("Buscar por nombre o documento"), "María");
    await user.click(await within(dialog).findByRole("button", { name: "Añadir a María Pérez" }));
    await waitFor(() => expect(added).toEqual({ student_ids: [7] }));
    expect(await screen.findByText("Estudiante cambiado a esta sección.")).toBeInTheDocument();
  });

  it("asigna el profesor de cada sección en el detalle de la materia", async () => {
    let put: unknown;
    server.use(
      http.get(`${API_URL}/subjects/10`, () => HttpResponse.json(mat)),
      http.get(`${API_URL}/subjects/10/teachers`, () =>
        HttpResponse.json([{ section: secA, teacher }]),
      ),
      http.get(`${API_URL}/subjects/10/students`, () => HttpResponse.json([])),
      http.get(`${API_URL}/teachers/5/subjects`, () =>
        HttpResponse.json([{ subject: mat, section: secA }]),
      ),
      http.put(`${API_URL}/teachers/5/subjects`, async ({ request }) => {
        put = await request.json();
        return HttpResponse.json([]);
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic/subjects/10");

    expect(
      await screen.findByRole("button", { name: "Quitar a José Méndez de la sección A" }),
    ).toBeInTheDocument();
    await user.selectOptions(await screen.findByLabelText("Profesor de la sección B"), "5");
    await user.click(screen.getByRole("button", { name: "Asignar" }));

    await waitFor(() =>
      expect(put).toEqual({
        assignments: [
          { subject_id: 10, section_id: 20 },
          { subject_id: 10, section_id: 21 },
        ],
      }),
    );
  });

  it("matricula varios estudiantes en una materia", async () => {
    const other: UserRead = {
      ...student,
      id: 8,
      full_name: "Carlos Gómez",
      cedula_display: "V-27118904",
    };
    let bulk: unknown;
    server.use(
      http.get(`${API_URL}/subjects/10`, () => HttpResponse.json(mat)),
      http.get(`${API_URL}/subjects/10/teachers`, () =>
        HttpResponse.json([{ section: secA, teacher }]),
      ),
      http.get(`${API_URL}/subjects/10/students`, () => HttpResponse.json([])),
      http.get(`${API_URL}/students`, () => HttpResponse.json(page([student, other]))),
      http.post(`${API_URL}/subjects/10/students`, async ({ request }) => {
        bulk = await request.json();
        return HttpResponse.json({ added: 1, already_enrolled: 1 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic/subjects/10");

    expect(
      await screen.findByRole("button", { name: "Quitar a José Méndez de la sección A" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Matricular estudiantes" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("checkbox", { name: /María Pérez/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Carlos Gómez/ }));
    await user.click(within(dialog).getByRole("button", { name: "Matricular (2)" }));

    await waitFor(() => expect(bulk).toEqual({ student_ids: [7, 8] }));
    expect(await screen.findByText("1 matriculados; 1 ya lo estaban.")).toBeInTheDocument();
  });
});

describe("nombre y apellido", () => {
  it("pide los dos por separado al crear un coordinador", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}/coordinators`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { user: makeUser({ id: 4, full_name: "Luisa Mora" }), generated_password: "x" },
          { status: 201 },
        );
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/coordinators/new");

    await user.type(await screen.findByLabelText("Nombre"), "Luisa");
    await user.type(screen.getByLabelText("Email"), "luisa@uni.edu");
    await user.click(screen.getByRole("button", { name: "Crear coordinador" }));

    expect(await screen.findByText("Escribe el apellido.")).toBeInTheDocument();
    expect(body).toBeUndefined();

    await user.type(screen.getByLabelText("Apellido"), "Mora");
    await user.click(screen.getByRole("button", { name: "Crear coordinador" }));
    await waitFor(() =>
      expect(body).toEqual({ first_name: "Luisa", last_name: "Mora", email: "luisa@uni.edu" }),
    );
  });

  it("edita nombre y apellido de un estudiante", async () => {
    let patch: unknown;
    server.use(
      http.get(`${API_URL}/students/7`, () => HttpResponse.json(student)),
      http.get(`${API_URL}/students/7/subjects`, () => HttpResponse.json([])),
      http.patch(`${API_URL}/students/7`, async ({ request }) => {
        patch = await request.json();
        return HttpResponse.json(student);
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/students/7");

    // Iniciales del avatar: nombre + apellido
    expect(await screen.findByText("MP")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Nombre")).toHaveValue("María");
    const last = within(dialog).getByLabelText("Apellido");
    await user.clear(last);
    await user.type(last, "Pérez Gómez");
    await user.click(within(dialog).getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(patch).toEqual({
        first_name: "María",
        last_name: "Pérez Gómez",
        nationality: "V",
        cedula: 28456123,
      }),
    );
  });
});
