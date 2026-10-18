import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import type { StudentOverview, StudentSubjectGrades } from "@/api/queries/student";
import { API_URL } from "@/lib/config";
import { makeUser, renderApp, signedInAs } from "./app";
import { server } from "./server";

const s2026 = { id: 2, name: "2026-I" };
const s2025 = { id: 1, name: "2025-II" };

const grades = (values: [number | null, number | null, number | null]) =>
  values.map((value, i) => ({ term: i + 1, value }));

const subject = (
  id: number,
  code: string,
  name: string,
  overrides: Partial<StudentSubjectGrades>,
  semester = s2026,
): StudentSubjectGrades => ({
  subject: { id, code, name, semester },
  teachers: ["José Méndez"],
  grades: grades([null, null, null]),
  average: null,
  projection: {
    standing: "in_progress",
    final_grade: null,
    pending_terms: [1, 2, 3],
    needed_average: 10,
  },
  ...overrides,
});

const mat = subject(10, "MAT-101", "Matemática I", {
  grades: grades([15.75, 17, null]),
  average: 16.38,
  projection: { standing: "secured", final_grade: null, pending_terms: [3], needed_average: null },
});
const fis = subject(11, "FIS-101", "Física I", {
  grades: grades([8, 9.5, null]),
  average: 8.75,
  projection: {
    standing: "in_progress",
    final_grade: null,
    pending_terms: [3],
    needed_average: 12.5,
  },
});
const prg = subject(12, "PRG-101", "Programación I", {
  grades: grades([18, 19.5, 20]),
  average: 19.17,
  projection: { standing: "passed", final_grade: 19.17, pending_terms: [], needed_average: null },
});
const qui = subject(13, "QUI-101", "Química I", {
  grades: grades([3, 4, null]),
  average: 3.5,
  projection: {
    standing: "impossible",
    final_grade: null,
    pending_terms: [3],
    needed_average: null,
  },
});
const old = subject(
  20,
  "INT-100",
  "Introducción",
  {
    grades: grades([12, 12, 12]),
    average: 12,
    projection: { standing: "passed", final_grade: 12, pending_terms: [], needed_average: null },
  },
  s2025,
);

const overview: StudentOverview = {
  subjects: [old, mat, fis, prg, qui],
  average: 11.95,
  // Promedios por semestre que calcula la API (el front no los recalcula)
  semesters: [
    { semester: s2026, average: 11.66, subjects_count: 4, passed_count: 1, failed_count: 0 },
    { semester: s2025, average: 12, subjects_count: 1, passed_count: 1, failed_count: 0 },
  ],
};

beforeEach(() => {
  localStorage.clear();
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

const card = async (name: string) =>
  (await screen.findByRole("heading", { name })).closest("a") as HTMLElement;

describe("mis notas", () => {
  it("muestra el semestre más reciente con el resumen y la situación de cada materia", async () => {
    renderApp("/student/grades");

    // Promedio del semestre elegido (de la API), no el general
    expect(await screen.findByText("Promedio del semestre")).toBeInTheDocument();
    expect(screen.getByText("Promedio del semestre").previousSibling).toHaveTextContent("11.66");
    expect(screen.getByText("Aprobadas").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("En curso").previousSibling).toHaveTextContent("1");
    expect(screen.getByText("En riesgo").previousSibling).toHaveTextContent("1");

    expect(within(await card("Matemática I")).getByText("Aprobada asegurada")).toBeInTheDocument();
    expect(
      within(await card("Matemática I")).getByText("Ya aprobaste aunque saques 1 en el Lapso 3."),
    ).toBeInTheDocument();
    const fisica = await card("Física I");
    expect(within(fisica).getByText("Necesitas 12.50")).toBeInTheDocument();
    expect(
      within(fisica).getByText("Necesitas al menos 12.50 en el Lapso 3 para aprobar."),
    ).toBeInTheDocument();
    expect(within(fisica).getByText("8.00")).toHaveClass("text-error");
    const prog = await card("Programación I");
    expect(within(prog).getByText("Definitiva")).toBeInTheDocument();
    expect(within(prog).getByText("Nota definitiva: 19.17.")).toBeInTheDocument();
    expect(
      within(await card("Química I")).getByText("Ya no es posible aprobar"),
    ).toBeInTheDocument();

    // El semestre anterior no se mezcla
    expect(screen.queryByRole("heading", { name: "Introducción" })).not.toBeInTheDocument();
  });

  it("cambia de semestre", async () => {
    const user = userEvent.setup();
    renderApp("/student/grades");

    await user.selectOptions(await screen.findByLabelText("Semestre"), "1");
    expect(await screen.findByRole("heading", { name: "Introducción" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Física I" })).not.toBeInTheDocument(),
    );
  });

  it("avisa si aún no está matriculado", async () => {
    server.use(
      http.get(`${API_URL}/student/subjects`, () =>
        HttpResponse.json({ subjects: [], average: null }),
      ),
    );
    renderApp("/student/grades");
    expect(
      await screen.findByText("Aún no estás matriculado en ninguna materia"),
    ).toBeInTheDocument();
  });
});

describe("detalle de materia", () => {
  it("explica qué necesita para aprobar y enlaza al asistente", async () => {
    server.use(http.get(`${API_URL}/student/subjects/11`, () => HttpResponse.json(fis)));
    renderApp("/student/grades/11");

    expect(await screen.findByText("12.50 en el Lapso 3")).toBeInTheDocument();
    expect(screen.getByText("Falta el lapso 3")).toBeInTheDocument();
    // Sin cálculos de notas en el front: no hay "puntos acumulados"
    expect(screen.queryByText(/puntos necesarios/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir asistente" })).toHaveAttribute(
      "href",
      `/student/assistant?${new URLSearchParams({ q: "¿Cuánto necesito para aprobar Física I?" })}`,
    );
  });

  it("con la materia cerrada muestra la definitiva", async () => {
    server.use(http.get(`${API_URL}/student/subjects/12`, () => HttpResponse.json(prg)));
    renderApp("/student/grades/12");

    expect(await screen.findByText("Materia cerrada")).toBeInTheDocument();
    expect(screen.getAllByText("Nota definitiva: 19.17.").length).toBeGreaterThan(0);
  });
});
