import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { api, authorizedFetch, unwrap } from "../client";
import type { components } from "../schema";

export type UserRead = components["schemas"]["UserRead"];
export type SubjectRead = components["schemas"]["SubjectRead"];
export type SemesterRead = components["schemas"]["SemesterRead"];
export type SectionRead = components["schemas"]["SectionRead"];
export type StudentSectionRead = components["schemas"]["StudentSectionRead"];
export type TeacherAssignment = components["schemas"]["TeacherAssignment"];
export type TeacherAssignmentRead = components["schemas"]["TeacherAssignmentRead"];
export type SubjectTeacherRead = components["schemas"]["SubjectTeacherRead"];

/** Tipos de cuenta que gestiona administración (cada uno con su recurso en la API) */
export type AccountKind = "coordinators" | "teachers" | "students";

export const PAGE_SIZE = 20;
/** Máximo que acepta la API por página; se usa para selectores con todas las opciones */
export const MAX_LIMIT = 100;

export type UserListParams = { q?: string; is_active?: boolean; offset?: number };

// Las tres rutas comparten parámetros y respuesta (Page<UserRead>)
const LIST_PATH = "/api/v1/teachers" as const;
const ITEM_PATH = "/api/v1/teachers/{user_id}" as const;
const RESET_PATH = "/api/v1/teachers/{user_id}/reset-password" as const;
const path = <P extends string>(kind: AccountKind, template: P) =>
  template.replace("teachers", kind) as P;

export const adminKeys = {
  users: (kind: AccountKind) => ["users", kind] as const,
  semesters: ["semesters"] as const,
  subjects: ["subjects"] as const,
  subject: (id: number) => ["subjects", "item", id] as const,
  teacherSubjects: (teacherId: number) => ["teachers", teacherId, "subjects"] as const,
  studentSubjects: (studentId: number) => ["students", studentId, "subjects"] as const,
  subjectTeachers: (subjectId: number) => ["subjects", subjectId, "teachers"] as const,
  subjectStudents: (subjectId: number) => ["subjects", subjectId, "students"] as const,
  sections: ["sections"] as const,
  semesterSections: (semesterId: number) => ["sections", "semester", semesterId] as const,
  sectionStudents: (sectionId: number) => ["sections", sectionId, "students"] as const,
  studentSections: (studentId: number) => ["sections", "student", studentId] as const,
};

export const usersQuery = (kind: AccountKind, params: UserListParams) =>
  queryOptions({
    queryKey: [...adminKeys.users(kind), "list", params],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET(path(kind, LIST_PATH), {
          params: { query: { ...params, q: params.q || undefined, limit: PAGE_SIZE } },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  });

export const userQuery = (kind: AccountKind, id: number) =>
  queryOptions({
    queryKey: [...adminKeys.users(kind), "item", id],
    queryFn: ({ signal }) =>
      unwrap(api.GET(path(kind, ITEM_PATH), { params: { path: { user_id: id } }, signal })),
  });

/** Profesores activos para los selectores de asignación */
export const activeTeachersQuery = queryOptions({
  queryKey: [...adminKeys.users("teachers"), "list", "active-all"],
  queryFn: ({ signal }) =>
    unwrap(
      api.GET("/api/v1/teachers", {
        params: { query: { is_active: true, limit: MAX_LIMIT } },
        signal,
      }),
    ),
});

export function resetPassword(kind: AccountKind, id: number) {
  return unwrap(api.POST(path(kind, RESET_PATH), { params: { path: { user_id: id } } }));
}

export const semestersQuery = queryOptions({
  queryKey: adminKeys.semesters,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/semesters", { signal })),
});

export type SubjectListParams = {
  semester_id?: number;
  q?: string;
  offset?: number;
  limit?: number;
};

export const subjectsQuery = (params: SubjectListParams) =>
  queryOptions({
    queryKey: [...adminKeys.subjects, "list", params],
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/subjects", {
          params: {
            query: { ...params, q: params.q || undefined, limit: params.limit ?? PAGE_SIZE },
          },
          signal,
        }),
      ),
    placeholderData: keepPreviousData,
  });

/** Todas las materias (hasta 100) para casillas y selectores */
export const allSubjectsQuery = subjectsQuery({ limit: MAX_LIMIT });

export const subjectQuery = (id: number) =>
  queryOptions({
    queryKey: adminKeys.subject(id),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/subjects/{subject_id}", { params: { path: { subject_id: id } }, signal }),
      ),
  });

export const teacherSubjectsQuery = (teacherId: number) =>
  queryOptions({
    queryKey: adminKeys.teacherSubjects(teacherId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/teachers/{teacher_id}/subjects", {
          params: { path: { teacher_id: teacherId } },
          signal,
        }),
      ),
  });

export const studentSubjectsQuery = (studentId: number) =>
  queryOptions({
    queryKey: adminKeys.studentSubjects(studentId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/students/{student_id}/subjects", {
          params: { path: { student_id: studentId } },
          signal,
        }),
      ),
  });

export const subjectTeachersQuery = (subjectId: number) =>
  queryOptions({
    queryKey: adminKeys.subjectTeachers(subjectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/subjects/{subject_id}/teachers", {
          params: { path: { subject_id: subjectId } },
          signal,
        }),
      ),
  });

export const subjectStudentsQuery = (subjectId: number) =>
  queryOptions({
    queryKey: adminKeys.subjectStudents(subjectId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/subjects/{subject_id}/students", {
          params: { path: { subject_id: subjectId } },
          signal,
        }),
      ),
  });

/**
 * Reemplaza las (materia, sección) del profesor. Cada materia tiene un solo profesor por
 * sección: si otro ya la imparte en esa sección, la API responde 409.
 */
export function setTeacherSubjects(teacherId: number, assignments: TeacherAssignment[]) {
  return unwrap(
    api.PUT("/api/v1/teachers/{teacher_id}/subjects", {
      params: { path: { teacher_id: teacherId } },
      body: { assignments },
    }),
  );
}

// --- Secciones -------------------------------------------------------------------
// Cada periodo tiene secciones; un estudiante cursa el periodo en una sola sección (hace
// falta para matricularlo) y cada materia tiene un único profesor por sección.

/** Secciones de un periodo con su número de estudiantes */
export const semesterSectionsQuery = (semesterId: number) =>
  queryOptions({
    queryKey: adminKeys.semesterSections(semesterId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/semesters/{semester_id}/sections", {
          params: { path: { semester_id: semesterId } },
          signal,
        }),
      ),
  });

export function createSection(semesterId: number, name: string) {
  return unwrap(
    api.POST("/api/v1/semesters/{semester_id}/sections", {
      params: { path: { semester_id: semesterId } },
      body: { name },
    }),
  );
}

export function renameSection(sectionId: number, name: string) {
  return unwrap(
    api.PATCH("/api/v1/sections/{section_id}", {
      params: { path: { section_id: sectionId } },
      body: { name },
    }),
  );
}

/** Solo sin estudiantes ni profesores (409) */
export function deleteSection(sectionId: number) {
  return unwrap(
    api.DELETE("/api/v1/sections/{section_id}", { params: { path: { section_id: sectionId } } }),
  );
}

export const sectionStudentsQuery = (sectionId: number) =>
  queryOptions({
    queryKey: adminKeys.sectionStudents(sectionId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/sections/{section_id}/students", {
          params: { path: { section_id: sectionId } },
          signal,
        }),
      ),
  });

/** Asigna estudiantes a la sección (si estaban en otra del periodo, se cambian; 409 con notas) */
export function assignSectionStudents(sectionId: number, studentIds: number[]) {
  return unwrap(
    api.POST("/api/v1/sections/{section_id}/students", {
      params: { path: { section_id: sectionId } },
      body: { student_ids: studentIds },
    }),
  );
}

/** Quita al estudiante de la sección (409 si está matriculado en materias del periodo) */
export function removeSectionStudent(sectionId: number, studentId: number) {
  return unwrap(
    api.DELETE("/api/v1/sections/{section_id}/students/{student_id}", {
      params: { path: { section_id: sectionId, student_id: studentId } },
    }),
  );
}

/** Sección del estudiante en cada periodo */
export const studentSectionsQuery = (studentId: number) =>
  queryOptions({
    queryKey: adminKeys.studentSections(studentId),
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/students/{student_id}/sections", {
          params: { path: { student_id: studentId } },
          signal,
        }),
      ),
  });

/** "MAT-101 Matemática I · Sección A" */
export const assignmentLabel = ({ subject, section }: TeacherAssignmentRead) =>
  `${subjectLabel(subject)} · Sección ${section.name}`;

/** "MAT-101 Matemática I" */
export const subjectLabel = (subject: SubjectRead) => `${subject.code} ${subject.name}`;

/** Agrupa materias por semestre, en el orden en que aparecen */
export function groupBySemester(subjects: SubjectRead[]) {
  const groups = new Map<number, { semester: SemesterRead; subjects: SubjectRead[] }>();
  for (const subject of subjects) {
    const group = groups.get(subject.semester.id) ?? { semester: subject.semester, subjects: [] };
    group.subjects.push(subject);
    groups.set(subject.semester.id, group);
  }
  return [...groups.values()];
}

type StaffCreate = components["schemas"]["StaffCreate"];
type StudentCreate = components["schemas"]["StudentCreate"];
export type StaffUpdate = components["schemas"]["StaffUpdate"];
export type StudentUpdate = components["schemas"]["StudentUpdate"];

/** Crea la cuenta; la respuesta trae la contraseña generada (solo se ve esta vez) */
export function createAccount(kind: "coordinators" | "teachers", body: StaffCreate) {
  return unwrap(api.POST(path(kind, LIST_PATH), { body }));
}

export function createStudent(body: StudentCreate) {
  return unwrap(api.POST("/api/v1/students", { body }));
}

export function updateAccount(kind: AccountKind, id: number, body: StaffUpdate | StudentUpdate) {
  const params = { path: { user_id: id } };
  if (kind === "students") {
    return unwrap(api.PATCH("/api/v1/students/{user_id}", { params, body: body as StudentUpdate }));
  }
  return unwrap(api.PATCH(path(kind, ITEM_PATH), { params, body: body as StaffUpdate }));
}

export function enrollStudentInSubjects(studentId: number, subjectIds: number[]) {
  return unwrap(
    api.POST("/api/v1/students/{student_id}/subjects", {
      params: { path: { student_id: studentId } },
      body: { subject_ids: subjectIds },
    }),
  );
}

/** Email del personal o documento del estudiante ("Cédula V-28456123") */
export const accountIdentity = (user: UserRead, documentLabel: string) =>
  user.email ?? (user.cedula_display ? `${documentLabel} ${user.cedula_display}` : "");

export type StudentImportResult = components["schemas"]["StudentImportResult"];
export type StudentImportRow = components["schemas"]["StudentImportRow"];

/** Plantilla .xlsx para el alta masiva de estudiantes */
export async function downloadStudentTemplate(): Promise<Blob> {
  const response = await authorizedFetch("/api/v1/students/import/template");
  return response.blob();
}

/**
 * Alta masiva desde Excel. Con `dryRun` solo valida y dice qué pasará con cada fila; sin él
 * crea los estudiantes nuevos (la respuesta trae su contraseña, que solo se ve esta vez) y
 * los matricula en las materias indicadas.
 */
export function importStudents(file: File, dryRun: boolean) {
  const form = new FormData();
  form.append("file", file);
  form.append("dry_run", String(dryRun));
  return unwrap(
    api.POST("/api/v1/students/import", {
      // openapi-fetch envía el FormData tal cual (el navegador pone el boundary)
      body: form as unknown as { file: string; dry_run: boolean },
    }),
  );
}
