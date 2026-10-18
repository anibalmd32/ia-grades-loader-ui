import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";
import type { components } from "../schema";

export type GradeChange = components["schemas"]["GradeChangeRead"];

/** Quién consulta: el profesor de la materia o la coordinación (rutas distintas en la API) */
export type GradeHistoryScope = "teacher" | "admin";

export type GradeHistoryParams = { studentId?: number; offset?: number };

export const HISTORY_PAGE_SIZE = 10;

export const gradeHistoryKeys = {
  all: ["grade-history"] as const,
  subject: (scope: GradeHistoryScope, subjectId: number) =>
    ["grade-history", scope, subjectId] as const,
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
      const params = {
        path: { subject_id: subjectId },
        query: { student_id: studentId, limit: HISTORY_PAGE_SIZE, offset },
      };
      return unwrap(
        scope === "teacher"
          ? api.GET("/api/v1/teacher/subjects/{subject_id}/grade-history", { params, signal })
          : api.GET("/api/v1/subjects/{subject_id}/grade-history", { params, signal }),
      );
    },
    placeholderData: keepPreviousData,
  });
