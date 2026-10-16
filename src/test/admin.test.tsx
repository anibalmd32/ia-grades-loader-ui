import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { SemesterRead, SubjectRead, UserRead } from "@/api/queries/admin";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

const page = <T,>(items: T[]) => ({ items, total: items.length, limit: 20, offset: 0 });

const s2026: SemesterRead = { id: 1, name: "2026-I" };
const s2025: SemesterRead = { id: 2, name: "2025-II" };
const mat: SubjectRead = { id: 10, code: "MAT-101", name: "Matemática I", semester: s2026 };
const fis: SubjectRead = { id: 11, code: "FIS-101", name: "Física I", semester: s2026 };

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

    await user.type(await screen.findByLabelText("Nombre completo"), "Ramón Díaz");
    await user.type(screen.getByLabelText("Email"), "ramon@uni.edu");
    await user.click(screen.getByRole("button", { name: "Crear profesor" }));

    const dialog = await screen.findByRole("dialog", { name: "Contraseña generada" });
    expect(within(dialog).getByTestId("generated-password")).toHaveTextContent("k7Q2-mXp9");
    expect(within(dialog).getByText("Ramón Díaz · ramon@uni.edu")).toBeInTheDocument();
    expect(body).toEqual({ full_name: "Ramón Díaz", email: "ramon@uni.edu" });
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

    await user.type(await screen.findByLabelText("Nombre completo"), "Ramón Díaz");
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

  it("asigna materias a un profesor (reemplaza el conjunto)", async () => {
    let put: unknown;
    server.use(
      http.get(`${API_URL}/teachers/5`, () => HttpResponse.json(teacher)),
      http.get(`${API_URL}/teachers/5/subjects`, () => HttpResponse.json([mat])),
      http.put(`${API_URL}/teachers/5/subjects`, async ({ request }) => {
        put = await request.json();
        return HttpResponse.json([mat, fis]);
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/teachers/5");

    const fisCheckbox = await screen.findByRole("checkbox", { name: "FIS-101 Física I" });
    expect(screen.getByRole("checkbox", { name: "MAT-101 Matemática I" })).toBeChecked();
    await user.click(fisCheckbox);
    await user.click(screen.getByRole("button", { name: "Guardar asignación" }));

    await waitFor(() => expect(put).toEqual({ subject_ids: [10, 11] }));
  });
});

describe("estudiantes", () => {
  it("crea un estudiante con cédula y lo matricula en las materias marcadas", async () => {
    let created: unknown;
    let enrolled: unknown;
    server.use(
      http.post(`${API_URL}/students`, async ({ request }) => {
        created = await request.json();
        return HttpResponse.json({ user: student, generated_password: "Est-1" }, { status: 201 });
      }),
      http.post(`${API_URL}/students/7/subjects`, async ({ request }) => {
        enrolled = await request.json();
        return HttpResponse.json({ added: 1, already_enrolled: 0 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/students/new");

    await user.type(await screen.findByLabelText("Nombre completo"), "María Pérez");
    await user.type(screen.getByLabelText("Número de cédula"), "28456123");
    await user.click(await screen.findByRole("checkbox", { name: "MAT-101 Matemática I" }));
    await user.click(screen.getByRole("button", { name: "Crear estudiante" }));

    expect(await screen.findByTestId("generated-password")).toHaveTextContent("Est-1");
    expect(created).toEqual({ full_name: "María Pérez", nationality: "V", cedula: 28456123 });
    expect(enrolled).toEqual({ subject_ids: [10] });
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
});

describe("semestres y materias", () => {
  it("muestra las materias del primer semestre y crea un semestre", async () => {
    let semesterQuery = "";
    let createdName: unknown;
    server.use(
      http.get(`${API_URL}/subjects`, ({ request }) => {
        semesterQuery = new URL(request.url).searchParams.get("semester_id") ?? "";
        return HttpResponse.json(page([mat, fis]));
      }),
      http.post(`${API_URL}/semesters`, async ({ request }) => {
        createdName = await request.json();
        return HttpResponse.json({ id: 3, name: "2027-I" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    expect((await screen.findAllByText("Matemática I")).length).toBeGreaterThan(0);
    expect(semesterQuery).toBe("1");

    await user.type(screen.getByLabelText("Nuevo semestre"), "2027-I");
    await user.click(screen.getByRole("button", { name: "Crear semestre" }));
    await waitFor(() => expect(createdName).toEqual({ name: "2027-I" }));
  });

  it("no elimina un semestre con materias y lo explica", async () => {
    server.use(
      http.delete(`${API_URL}/semesters/1`, () =>
        HttpResponse.json({ detail: "El semestre tiene materias" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic");

    await user.click(await screen.findByRole("button", { name: "Eliminar 2026-I" }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: "Eliminar" }),
    );

    expect(await screen.findByText("El semestre tiene materias")).toBeInTheDocument();
  });

  it("crea una materia y le asigna el profesor elegido", async () => {
    let subjectBody: unknown;
    let teacherPut: unknown;
    server.use(
      http.post(`${API_URL}/subjects`, async ({ request }) => {
        subjectBody = await request.json();
        return HttpResponse.json(
          { id: 12, code: "QUI-101", name: "Química I", semester: s2026 },
          { status: 201 },
        );
      }),
      http.get(`${API_URL}/teachers/5/subjects`, () => HttpResponse.json([mat])),
      http.put(`${API_URL}/teachers/5/subjects`, async ({ request }) => {
        teacherPut = await request.json();
        return HttpResponse.json([]);
      }),
    );
    const user = userEvent.setup();
    const { router } = renderApp("/admin/academic/new?semester=1");

    await user.type(await screen.findByLabelText("Código"), "QUI-101");
    await user.type(screen.getByLabelText("Nombre"), "Química I");
    await user.selectOptions(await screen.findByLabelText("Profesor (opcional)"), "5");
    await user.click(screen.getByRole("button", { name: "Crear materia" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/admin/academic"));
    expect(subjectBody).toEqual({ semester_id: 1, code: "QUI-101", name: "Química I" });
    expect(teacherPut).toEqual({ subject_ids: [10, 12] });
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
      http.get(`${API_URL}/subjects/10/teachers`, () => HttpResponse.json([teacher])),
      http.get(`${API_URL}/subjects/10/students`, () => HttpResponse.json([])),
      http.get(`${API_URL}/students`, () => HttpResponse.json(page([student, other]))),
      http.post(`${API_URL}/subjects/10/students`, async ({ request }) => {
        bulk = await request.json();
        return HttpResponse.json({ added: 1, already_enrolled: 1 });
      }),
    );
    const user = userEvent.setup();
    renderApp("/admin/academic/subjects/10");

    expect(await screen.findByText("José Méndez")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Matricular estudiantes" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("checkbox", { name: /María Pérez/ }));
    await user.click(within(dialog).getByRole("checkbox", { name: /Carlos Gómez/ }));
    await user.click(within(dialog).getByRole("button", { name: "Matricular (2)" }));

    await waitFor(() => expect(bulk).toEqual({ student_ids: [7, 8] }));
    expect(await screen.findByText("1 matriculados; 1 ya lo estaban.")).toBeInTheDocument();
  });
});
