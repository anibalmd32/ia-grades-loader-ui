import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";
import type { components } from "../schema";

export type GradeChange = components["schemas"]["GradeChangeRead"];

/**
 * Quién consulta: el profesor de la materia en una de sus secciones (solo ve los cambios de
 * sus estudiantes) o la coordinación (toda la materia). Rutas distintas en la API.
 */
export type GradeHistoryScope = { kind: "teacher"; sectionId: number } | { kind: "admin" };

export type GradeHistoryParams = { studentId?: number; offset?: number };

export const HISTORY_PAGE_SIZE = 10;

export const gradeHistoryKeys = {
  all: ["grade-history"] as const,
  subject: (scope: GradeHistoryScope, subjectId: number) =>
    [
      "grade-history",
      scope.kind,
      subjectId,
      scope.kind === "teacher" ? scope.sectionId : null,
    ] as const,
};

/** Altas, correcciones y borrados de notas de la materia, del más reciente al más antiguo */
export const gradeHistoryQuery = (
  scope: GradeHistoryScope,
  subjectId: number,
  { studentId, offset = 0 }: GradeHistoryParams,
) =>
  queryOptions({
    queryKey: [...gradeHistoryKeys.subject(scope, subjectId), { studentId, offset }],
    queryFn: ({ signal }) => {
      const query = { student_id: studentId, limit: HISTORY_PAGE_SIZE, offset };
      return unwrap(
        scope.kind === "teacher"
          ? api.GET("/api/v1/teacher/subjects/{subject_id}/sections/{section_id}/grade-history", {
              params: { path: { subject_id: subjectId, section_id: scope.sectionId }, query },
              signal,
            })
          : api.GET("/api/v1/subjects/{subject_id}/grade-history", {
              params: { path: { subject_id: subjectId }, query },
              signal,
            }),
      );
    },
    placeholderData: keepPreviousData,
  });
