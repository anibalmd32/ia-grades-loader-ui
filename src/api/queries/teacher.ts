import { queryOptions } from "@tanstack/react-query";
import { readDownload } from "@/lib/download";
import { api, authorizedFetch, unwrap } from "../client";
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

/** Número de lapso: de 1 a `terms_count` de la configuración académica (`termNumbers`) */
export type Term = number;

export const teacherKeys = {
  all: ["teacher"] as const,
  subjects: ["teacher", "subjects"] as const,
  grades: (subjectId: number, sectionId: number) =>
    ["teacher", "grades", subjectId, sectionId] as const,
  jobs: ["teacher", "import-jobs"] as const,
  job: (jobId: string) => ["teacher", "import-jobs", "item", jobId] as const,
};

/**
 * Materias asignadas al profesor: una por cada sección en la que las imparte, con el número
 * de estudiantes de esa sección. El profesor solo ve y califica a los de sus secciones.
 */
export const teacherSubjectsQuery = queryOptions({
  queryKey: teacherKeys.subjects,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/teacher/subjects", { signal })),
});

const classPath = (subjectId: number, sectionId: number) => ({
  subject_id: subjectId,
  section_id: sectionId,
});

/** Estudiantes de la sección matriculados en la materia y su nota de cada lapso */
export const subjectGradesQuery = (subjectId: number, sectionId: number) =>
  queryOptions({
    queryKey: teacherKeys.grades(subjectId, sectionId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/grades", {
          params: { path: classPath(subjectId, sectionId) },
          signal,
        }),
      ),
  });

/**
 * Guarda en lote solo las notas que cambian (`value: null` borra; `absent: true` sin valor
 * marca inasistente). Todo o nada. Con `importJobId`, la API marca esa importación como
 * confirmada (`confirmed_at`).
 */
export function saveGrades(
  subjectId: number,
  sectionId: number,
  grades: GradeEntry[],
  importJobId?: string,
) {
  return unwrap(
    api.PUT("/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/grades", {
      params: { path: classPath(subjectId, sectionId) },
      body: importJobId ? { grades, import_job_id: importJobId } : { grades },
    }),
  );
}

/** Excel con la planilla de la sección y una hoja por cada lapso con plan de evaluación */
export async function downloadSubjectGrades(subjectId: number, sectionId: number) {
  const response = await authorizedFetch(
    `/api/v1/teacher/subjects/${subjectId}/sections/${sectionId}/grades/export`,
  );
  return readDownload(response, "notas.xlsx");
}

/** Estado actual de cada nota de la materia, para la planilla */
export function gradeOf(row: StudentGrades, term: Term): number | null {
  return row.grades.find((g) => g.term === term)?.value ?? null;
}

/** ¿Es inasistente en ese lapso? (su nota es la mínima de la escala) */
export function isAbsent(row: StudentGrades, term: Term): boolean {
  return row.grades.find((g) => g.term === term)?.absent ?? false;
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
export function uploadImport(
  subjectId: number,
  sectionId: number,
  file: File,
  defaultTerm: Term | null,
) {
  const form = new FormData();
  form.append("file", file);
  if (defaultTerm) form.append("default_term", String(defaultTerm));
  return unwrap(
    api.POST("/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/grades/import", {
      params: { path: classPath(subjectId, sectionId) },
      // openapi-fetch envía el FormData tal cual (el navegador pone el boundary)
      body: form as unknown as { file: string },
    }),
  );
}
