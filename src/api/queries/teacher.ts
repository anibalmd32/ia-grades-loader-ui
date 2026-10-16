import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";
import type { components } from "../schema";

export type TeacherSubject = components["schemas"]["TeacherSubject"];
export type SubjectGrades = components["schemas"]["SubjectGrades"];
export type StudentGrades = components["schemas"]["StudentGrades"];
export type GradeEntry = components["schemas"]["GradeEntry"];
export type ImportJobSummary = components["schemas"]["ImportJobSummary"];
export type ImportJobRead = components["schemas"]["ImportJobRead"];
export type ImportRow = components["schemas"]["ImportRow"];
export type JobStatus = components["schemas"]["JobStatus"];

export const TERMS = [1, 2, 3] as const;
export type Term = (typeof TERMS)[number];

export const teacherKeys = {
  all: ["teacher"] as const,
  subjects: ["teacher", "subjects"] as const,
  grades: (subjectId: number) => ["teacher", "grades", subjectId] as const,
  jobs: ["teacher", "import-jobs"] as const,
  job: (jobId: string) => ["teacher", "import-jobs", "item", jobId] as const,
};

/** Materias asignadas al profesor, con el número de estudiantes matriculados */
export const teacherSubjectsQuery = queryOptions({
  queryKey: teacherKeys.subjects,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/teacher/subjects", { signal })),
});

/** Estudiantes matriculados en la materia y su nota de cada lapso */
export const subjectGradesQuery = (subjectId: number) =>
  queryOptions({
    queryKey: teacherKeys.grades(subjectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teacher/subjects/{subject_id}/grades", {
          params: { path: { subject_id: subjectId } },
          signal,
        }),
      ),
  });

/** Guarda en lote solo las notas que cambian (`value: null` borra). Todo o nada. */
export function saveGrades(subjectId: number, grades: GradeEntry[]) {
  return unwrap(
    api.PUT("/api/v1/teacher/subjects/{subject_id}/grades", {
      params: { path: { subject_id: subjectId } },
      body: { grades },
    }),
  );
}

/** Estado actual de cada nota de la materia, para la planilla */
export function gradeOf(row: StudentGrades, term: Term): number | null {
  return row.grades.find((g) => g.term === term)?.value ?? null;
}

/** La definitiva solo existe con los 3 lapsos cargados (la calcula la API: `average`) */
export function finalGrade(row: StudentGrades): number | null {
  return row.grades.every((g) => g.value != null) ? row.average : null;
}
