import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";
import { isApiError } from "../errors";
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

/** En cola o leyéndose: hay que seguir consultando su estado */
export const isActiveJob = (status: JobStatus) => status === "pending" || status === "processing";

const POLL_MS = 2000;

/** Importaciones recientes del profesor; se refresca sola mientras alguna esté en curso */
export const importJobsQuery = queryOptions({
  queryKey: teacherKeys.jobs,
  queryFn: ({ signal }) =>
    unwrap(api.GET("/api/v1/teacher/import-jobs", { params: { query: { limit: 20 } }, signal })),
  refetchInterval: (query) =>
    query.state.data?.some((job) => isActiveJob(job.status)) ? POLL_MS : false,
});

/** Estado y previsualización de una importación; sondea hasta que termina (done o failed) */
export const importJobQuery = (jobId: string) =>
  queryOptions({
    queryKey: teacherKeys.job(jobId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teacher/import-jobs/{job_id}", {
          params: { path: { job_id: jobId } },
          signal,
        }),
      ),
    refetchInterval: (query) => {
      const { error, data } = query.state;
      // 4xx (no existe, sin permiso): no tiene sentido seguir preguntando
      if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
      if (data && !isActiveJob(data.status)) return false;
      // Un fallo puntual (red, 5xx) no detiene el seguimiento: se reintenta más despacio
      return error ? POLL_MS * 3 : POLL_MS;
    },
  });

/** Sube el Excel; la API responde al instante (202) con el trabajo en cola */
export function uploadImport(subjectId: number, file: File, defaultTerm: Term | null) {
  const form = new FormData();
  form.append("file", file);
  if (defaultTerm) form.append("default_term", String(defaultTerm));
  return unwrap(
    api.POST("/api/v1/teacher/subjects/{subject_id}/grades/import", {
      params: { path: { subject_id: subjectId } },
      // openapi-fetch envía el FormData tal cual (el navegador pone el boundary)
      body: form as unknown as { file: string },
    }),
  );
}
