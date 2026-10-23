import { queryOptions } from "@tanstack/react-query";
import { readDownload } from "@/lib/download";
import { api, authorizedFetch, unwrap } from "../client";
import type { components } from "../schema";

export type EvaluationPlan = components["schemas"]["EvaluationPlan"];
export type Evaluation = components["schemas"]["EvaluationRead"];
export type EvaluationCreate = components["schemas"]["EvaluationCreate"];
export type EvaluationUpdate = components["schemas"]["EvaluationUpdate"];
export type TermPlan = components["schemas"]["TermPlan"];
export type TermEvaluationGrades = components["schemas"]["TermEvaluationGrades"];
export type StudentEvaluationGrades = components["schemas"]["StudentEvaluationGrades"];
export type EvaluationGradeEntry = components["schemas"]["EvaluationGradeEntry"];
export type StudentEvaluation = components["schemas"]["StudentEvaluation"];

// Cada sección tiene su propio plan: todo va por (materia, sección)
export const evaluationKeys = {
  all: ["teacher", "evaluations"] as const,
  plan: (subjectId: number, sectionId: number) =>
    ["teacher", "evaluations", subjectId, sectionId, "plan"] as const,
  grades: (subjectId: number, sectionId: number, term: number) =>
    ["teacher", "evaluations", subjectId, sectionId, "grades", term] as const,
};

const classPath = (subjectId: number, sectionId: number) => ({
  subject_id: subjectId,
  section_id: sectionId,
});

/** Plan de evaluación de la materia en la sección: evaluaciones de cada lapso con su porcentaje */
export const evaluationPlanQuery = (subjectId: number, sectionId: number) =>
  queryOptions({
    queryKey: evaluationKeys.plan(subjectId, sectionId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/evaluations", {
          params: { path: classPath(subjectId, sectionId) },
          signal,
        }),
      ),
  });

/** Notas de cada estudiante en las evaluaciones de un lapso (y la nota del lapso, de la API) */
export const termEvaluationGradesQuery = (subjectId: number, sectionId: number, term: number) =>
  queryOptions({
    queryKey: evaluationKeys.grades(subjectId, sectionId, term),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET(
          "/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/terms/{term}/evaluation-grades",
          { params: { path: { ...classPath(subjectId, sectionId), term } }, signal },
        ),
      ),
  });

export function createEvaluation(subjectId: number, sectionId: number, body: EvaluationCreate) {
  return unwrap(
    api.POST("/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/evaluations", {
      params: { path: classPath(subjectId, sectionId) },
      body,
    }),
  );
}

export function updateEvaluation(
  subjectId: number,
  sectionId: number,
  evaluationId: number,
  body: EvaluationUpdate,
) {
  return unwrap(
    api.PATCH(
      "/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/evaluations/{evaluation_id}",
      {
        params: { path: { ...classPath(subjectId, sectionId), evaluation_id: evaluationId } },
        body,
      },
    ),
  );
}

export function deleteEvaluation(subjectId: number, sectionId: number, evaluationId: number) {
  return unwrap(
    api.DELETE(
      "/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/evaluations/{evaluation_id}",
      { params: { path: { ...classPath(subjectId, sectionId), evaluation_id: evaluationId } } },
    ),
  );
}

/**
 * Guarda en lote las notas que cambian (`value: null` borra; `absent: true` sin valor marca
 * inasistente en esa evaluación). Todo o nada
 */
export function saveEvaluationGrades(
  subjectId: number,
  sectionId: number,
  term: number,
  grades: EvaluationGradeEntry[],
) {
  return unwrap(
    api.PUT(
      "/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/terms/{term}/evaluation-grades",
      { params: { path: { ...classPath(subjectId, sectionId), term } }, body: { grades } },
    ),
  );
}

/** Excel con las notas de las evaluaciones de un lapso, lo acumulado y la nota del lapso */
export async function downloadTermEvaluationGrades(
  subjectId: number,
  sectionId: number,
  term: number,
) {
  const response = await authorizedFetch(
    `/api/v1/teacher/subjects/${subjectId}/sections/${sectionId}/terms/${term}/evaluation-grades/export`,
  );
  return readDownload(response, "notas.xlsx");
}

/** Nota del estudiante en una evaluación (null si no tiene) */
export function evaluationGradeOf(row: StudentEvaluationGrades, evaluationId: number) {
  return row.grades.find((g) => g.evaluation_id === evaluationId)?.value ?? null;
}

/** ¿Fue inasistente a la evaluación? (su nota es la mínima de la escala) */
export function isAbsentFrom(row: StudentEvaluationGrades, evaluationId: number) {
  return row.grades.find((g) => g.evaluation_id === evaluationId)?.absent ?? false;
}

/** "25 %" (sin ceros de relleno) */
export function percentText(value: number): string {
  return `${Number(value.toFixed(2))} %`;
}
