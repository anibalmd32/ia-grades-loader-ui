import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";
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

export const evaluationKeys = {
  all: ["teacher", "evaluations"] as const,
  plan: (subjectId: number) => ["teacher", "evaluations", subjectId, "plan"] as const,
  grades: (subjectId: number, term: number) =>
    ["teacher", "evaluations", subjectId, "grades", term] as const,
};

/** Plan de evaluación de la materia: evaluaciones de cada lapso con su porcentaje */
export const evaluationPlanQuery = (subjectId: number) =>
  queryOptions({
    queryKey: evaluationKeys.plan(subjectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teacher/subjects/{subject_id}/evaluations", {
          params: { path: { subject_id: subjectId } },
          signal,
        }),
      ),
  });

/** Notas de cada estudiante en las evaluaciones de un lapso (y la nota del lapso, de la API) */
export const termEvaluationGradesQuery = (subjectId: number, term: number) =>
  queryOptions({
    queryKey: evaluationKeys.grades(subjectId, term),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teacher/subjects/{subject_id}/terms/{term}/evaluation-grades", {
          params: { path: { subject_id: subjectId, term } },
          signal,
        }),
      ),
  });

export function createEvaluation(subjectId: number, body: EvaluationCreate) {
  return unwrap(
    api.POST("/api/v1/teacher/subjects/{subject_id}/evaluations", {
      params: { path: { subject_id: subjectId } },
      body,
    }),
  );
}

export function updateEvaluation(subjectId: number, evaluationId: number, body: EvaluationUpdate) {
  return unwrap(
    api.PATCH("/api/v1/teacher/subjects/{subject_id}/evaluations/{evaluation_id}", {
      params: { path: { subject_id: subjectId, evaluation_id: evaluationId } },
      body,
    }),
  );
}

export function deleteEvaluation(subjectId: number, evaluationId: number) {
  return unwrap(
    api.DELETE("/api/v1/teacher/subjects/{subject_id}/evaluations/{evaluation_id}", {
      params: { path: { subject_id: subjectId, evaluation_id: evaluationId } },
    }),
  );
}

/** Guarda en lote las notas que cambian (`value: null` borra). Todo o nada */
export function saveEvaluationGrades(
  subjectId: number,
  term: number,
  grades: EvaluationGradeEntry[],
) {
  return unwrap(
    api.PUT("/api/v1/teacher/subjects/{subject_id}/terms/{term}/evaluation-grades", {
      params: { path: { subject_id: subjectId, term } },
      body: { grades },
    }),
  );
}

/** Nota del estudiante en una evaluación (null si no tiene) */
export function evaluationGradeOf(row: StudentEvaluationGrades, evaluationId: number) {
  return row.grades.find((g) => g.evaluation_id === evaluationId)?.value ?? null;
}

/** "25 %" (sin ceros de relleno) */
export function percentText(value: number): string {
  return `${Number(value.toFixed(2))} %`;
}
