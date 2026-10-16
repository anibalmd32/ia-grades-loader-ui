import { queryOptions } from "@tanstack/react-query";
import { api, unwrap } from "../client";
import type { components } from "../schema";

export type StudentOverview = components["schemas"]["StudentOverview"];
export type StudentSubjectGrades = components["schemas"]["StudentSubjectGrades"];
export type SubjectProjection = components["schemas"]["SubjectProjection"];
export type Standing = SubjectProjection["standing"];

export const studentKeys = {
  all: ["student"] as const,
  subjects: ["student", "subjects"] as const,
  subject: (id: number) => ["student", "subjects", id] as const,
};

/** Todas mis materias con la nota de cada lapso, el promedio y la proyección (de la API) */
export const studentOverviewQuery = queryOptions({
  queryKey: studentKeys.subjects,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/student/subjects", { signal })),
});

export const studentSubjectQuery = (subjectId: number) =>
  queryOptions({
    queryKey: studentKeys.subject(subjectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/student/subjects/{subject_id}", {
          params: { path: { subject_id: subjectId } },
          signal,
        }),
      ),
  });
