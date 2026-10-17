import { useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import * as v from "valibot";
import { groupBySemester } from "@/api/queries/admin";
import { teacherSubjectsQuery } from "@/api/queries/teacher";
import { SubjectCard } from "@/components/teacher/subject-card";
import { PageBody, PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";

const title = "Mis materias";
const description = "Materias que tienes asignadas este período.";

export const Route = createFileRoute("/_app/teacher/subjects/")({
  validateSearch: v.object({
    q: v.optional(v.fallback(v.string(), ""), ""),
    semester: v.optional(v.fallback(v.optional(v.pipe(v.number(), v.integer())), undefined)),
  }),
  search: { middlewares: [stripSearchParams({ q: "" })] },
  staticData: { title, description },
  component: TeacherSubjectsPage,
});

function TeacherSubjectsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const subjects = useQuery(teacherSubjectsQuery);

  const semesters = groupBySemester(subjects.data ?? []).map((g) => g.semester);
  const term = search.q.trim().toLowerCase();
  const visible = subjects.data?.filter(
    (s) =>
      (search.semester === undefined || s.semester.id === search.semester) &&
      (!term || s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)),
  );

  return (
    <>
      <PageHeader title={title} description={description} />
      <PageBody>
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchInput
            value={search.q}
            placeholder="Buscar materia"
            onChange={(q) => navigate({ search: (prev) => ({ ...prev, q }), replace: true })}
          />
          <select
            className="select w-full sm:max-w-56"
            aria-label="Filtrar por semestre"
            value={search.semester ?? ""}
            onChange={(event) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  semester: event.target.value ? Number(event.target.value) : undefined,
                }),
                replace: true,
              })
            }
          >
            <option value="">Semestre: Todos</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={semester.id}>
                Semestre: {semester.name}
              </option>
            ))}
          </select>
        </div>

        {subjects.error ? (
          <ErrorState error={subjects.error} onRetry={() => subjects.refetch()} />
        ) : !visible ? (
          <LoadingState rows={3} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={
              subjects.data?.length
                ? "Sin resultados para la búsqueda"
                : "Aún no tienes materias asignadas"
            }
            description={
              subjects.data?.length
                ? undefined
                : "Pide a la coordinación que te asigne las materias que impartes."
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((subject) => (
              <SubjectCard key={subject.id} subject={subject} />
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
